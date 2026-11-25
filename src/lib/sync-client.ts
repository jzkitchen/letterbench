import { workerUrl, workerUrlIsPlaceholder } from "./api-config";
import { buildBackup } from "./backup";
import { repo } from "./db";
import { readPrefs, writePrefs } from "./prefs";
import { fetchRemote, putRemote } from "./remote";
import { decideSync, type LocalSnapshot } from "./sync";

export const SYNC_BASE_KEY = "letterbench-sync";
const OLD_PASSWORD_KEY = "letterbench-family-password";
export const NOTICE_KEY = "letterbench-sync-notice";

export type SyncPhase = "unconfigured" | "offline" | "idle" | "updated";

const OFFLINE_NOTICE = "Offline. This device will sync when you are back online.";
const UNCONFIGURED_NOTICE = "Online sync is not configured yet. Everything stays on this device.";

function publishNotice(text: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (text) sessionStorage.setItem(NOTICE_KEY, text);
  else sessionStorage.removeItem(NOTICE_KEY);
  window.dispatchEvent(new Event("letterbench-sync"));
}

function readBase(): LocalSnapshot | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_BASE_KEY) ?? "") as Partial<LocalSnapshot>;
    if (!parsed || !Array.isArray(parsed.sets) || !Array.isArray(parsed.sessions) || !parsed.settings) return null;
    return { sets: parsed.sets, sessions: parsed.sessions, settings: parsed.settings };
  } catch {
    return null;
  }
}

function writeBase(snapshot: LocalSnapshot): void {
  localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(snapshot));
}

function forgetPassword(): void {
  try {
    localStorage.removeItem(OLD_PASSWORD_KEY);
  } catch {
    // The password is no longer used.
  }
}

async function loadLocal(): Promise<LocalSnapshot> {
  const store = await repo();
  const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
  return { sets, sessions, settings: readPrefs() };
}

async function writeLocal(snapshot: LocalSnapshot): Promise<void> {
  const store = await repo();
  await store.replaceAll(snapshot.sets, snapshot.sessions);
  writePrefs(snapshot.settings);
}

async function syncBody(): Promise<SyncPhase> {
  forgetPassword();
  if (workerUrlIsPlaceholder()) {
    publishNotice(UNCONFIGURED_NOTICE);
    return "unconfigured";
  }
  const remote = await fetchRemote(workerUrl());
  if (!remote) {
    publishNotice(OFFLINE_NOTICE);
    return "offline";
  }
  const local = await loadLocal();
  const decision = decideSync(local, remote, readBase());
  if (decision.kind === "offline") {
    publishNotice(OFFLINE_NOTICE);
    return "offline";
  }
  if (decision.kind === "idle") {
    writeBase(local);
    publishNotice(null);
    return "idle";
  }
  if (decision.writeLocal) await writeLocal(decision.merged);
  if (decision.upload) {
    const status = await putRemote(workerUrl(), buildBackup(decision.merged.sets, decision.merged.sessions, decision.merged.settings));
    if (status !== 200) {
      publishNotice(OFFLINE_NOTICE);
      return decision.writeLocal ? "updated" : "offline";
    }
  }
  writeBase(decision.merged);
  publishNotice(null);
  return decision.writeLocal ? "updated" : "idle";
}

let chain: Promise<SyncPhase> = Promise.resolve("idle");

export function syncNow(): Promise<SyncPhase> {
  const run = chain.then(syncBody, syncBody);
  chain = run.then(
    (phase) => phase,
    () => "offline" as SyncPhase,
  );
  return run;
}

let syncTimer = 0;

export function scheduleSync(): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    void syncNow();
  }, 400);
}
