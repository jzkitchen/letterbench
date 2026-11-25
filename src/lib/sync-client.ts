import { workerUrl, workerUrlIsPlaceholder } from "./api-config";
import { buildBackup, type BackupFile } from "./backup";
import { repo } from "./db";
import { readPrefs, writePrefs } from "./prefs";
import { fetchRemote, putRemote } from "./remote";
import { fingerprint, planSync, type SyncMeta } from "./sync";
import type { DictationSet, Session } from "./types";

export const SYNC_META_KEY = "letterbench-sync";
export const PASSWORD_KEY = "letterbench-family-password";
export const NOTICE_KEY = "letterbench-sync-notice";

export const LOCAL_ONLY_NOTICE = "Saved on this device only. Enter the family password to copy it online.";

export type SyncPhase = "unconfigured" | "offline" | "idle" | "hydrated" | "uploaded" | "local-only" | "conflict" | "rejected" | "unavailable";

export function readFamilyPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeFamilyPassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password);
}

export function clearFamilyPassword(): void {
  localStorage.removeItem(PASSWORD_KEY);
}

export function readSyncMeta(): SyncMeta | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_META_KEY) ?? "") as Partial<SyncMeta>;
    if (!parsed || typeof parsed.baseExportedAt !== "string" || typeof parsed.fingerprint !== "string") return null;
    return { baseExportedAt: parsed.baseExportedAt, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
}

function writeSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

export function publishNotice(text: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (text) sessionStorage.setItem(NOTICE_KEY, text);
  else sessionStorage.removeItem(NOTICE_KEY);
  window.dispatchEvent(new Event("letterbench-sync"));
}

function rememberSync(backup: BackupFile, sets: DictationSet[], sessions: Session[]): void {
  writeSyncMeta({
    baseExportedAt: backup.exportedAt,
    fingerprint: fingerprint(sets, sessions, readPrefs()),
  });
}

export async function applyRemote(backup: BackupFile): Promise<void> {
  const store = await repo();
  await store.replaceAll(backup.sets, backup.sessions);
  writePrefs(backup.settings);
  const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
  rememberSync(backup, sets, sessions);
  publishNotice(null);
}

async function currentSnapshot(): Promise<{ sets: DictationSet[]; sessions: Session[]; backup: BackupFile }> {
  const store = await repo();
  const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
  const settings = readPrefs();
  return { sets, sessions, backup: buildBackup(sets, sessions, settings) };
}

export async function pushLocal(password: string): Promise<SyncPhase> {
  if (workerUrlIsPlaceholder()) {
    publishNotice("Online sync is not configured yet. This change stays on this device.");
    return "unconfigured";
  }
  const { sets, sessions, backup } = await currentSnapshot();
  try {
    const status = await putRemote(workerUrl(), backup, password);
    if (status === 200) {
      rememberSync(backup, sets, sessions);
      publishNotice(null);
      return "uploaded";
    }
    if (status === 401) {
      clearFamilyPassword();
      publishNotice("That family password was not accepted. The change is still on this device.");
      return "rejected";
    }
    if (status === 503) {
      publishNotice("The online copy is not ready for writes yet. Saved on this device.");
      return "unavailable";
    }
    publishNotice("Couldn't reach the online copy. Saved on this device.");
    return "offline";
  } catch {
    publishNotice("Couldn't reach the online copy. Saved on this device.");
    return "offline";
  }
}

export async function pushLocalIfPossible(): Promise<SyncPhase> {
  const password = readFamilyPassword();
  if (!password) {
    if (workerUrlIsPlaceholder()) {
      publishNotice("Online sync is not configured yet. This change stays on this device.");
      return "unconfigured";
    }
    publishNotice(LOCAL_ONLY_NOTICE);
    return "local-only";
  }
  return pushLocal(password);
}

let pushTimer = 0;

export function schedulePush(): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    void pushLocalIfPossible();
  }, 400);
}

export async function runStartupSync(): Promise<SyncPhase> {
  if (workerUrlIsPlaceholder()) return "unconfigured";
  const remote = await fetchRemote(workerUrl());
  const store = await repo();
  const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
  const plan = planSync({ sets, sessions, settings: readPrefs() }, remote, readSyncMeta());
  if (plan.kind === "offline") return "offline";
  if (plan.kind === "idle") return "idle";
  if (plan.kind === "conflict") return "conflict";
  if (plan.kind === "hydrate") {
    await applyRemote(plan.backup);
    return "hydrated";
  }
  const password = readFamilyPassword();
  if (!password) {
    publishNotice(LOCAL_ONLY_NOTICE);
    return "local-only";
  }
  return pushLocal(password);
}

export async function refreshFromOnline(): Promise<SyncPhase> {
  if (workerUrlIsPlaceholder()) return "unconfigured";
  const remote = await fetchRemote(workerUrl());
  if (!remote) return "offline";
  if (remote.exportedAt === "" && remote.sets.length === 0 && remote.sessions.length === 0) return "idle";
  await applyRemote(remote);
  return "hydrated";
}
