import { DEFAULT_PREFS } from "./prefs";
import type { BackupFile } from "./backup";
import type { DictationSet, Prefs, Session } from "./types";

export type LocalSnapshot = {
  sets: DictationSet[];
  sessions: Session[];
  settings: Prefs;
};

export type SyncMeta = {
  baseExportedAt: string;
  fingerprint: string;
};

export type SyncPlan =
  | { kind: "offline" }
  | { kind: "idle" }
  | { kind: "hydrate"; backup: BackupFile }
  | { kind: "upload" }
  | { kind: "conflict" };

export function fingerprint(sets: DictationSet[], sessions: Session[], settings: Prefs): string {
  const setPart = [...sets]
    .map((set) => `${set.id}|${set.updatedAt}|${set.createdAt}|${set.title}|${set.items.map((item) => `${item.id}:${item.body}`).join(",")}`)
    .sort()
    .join("\n");
  const sessionPart = [...sessions]
    .map(
      (session) =>
        `${session.id}|${session.updatedAt}|${session.finishedAt ?? ""}|${session.attempts.map((attempt) => `${attempt.position}:${attempt.letters}:${attempt.correct}`).join(",")}`,
    )
    .sort()
    .join("\n");
  return `${JSON.stringify(settings)}\n${setPart}\n${sessionPart}`;
}

function localHasData(local: LocalSnapshot): boolean {
  return local.sets.length > 0 || local.sessions.length > 0 || JSON.stringify(local.settings) !== JSON.stringify(DEFAULT_PREFS);
}

function remoteHasData(remote: BackupFile): boolean {
  return remote.exportedAt !== "" || remote.sets.length > 0 || remote.sessions.length > 0 || remote.results.length > 0;
}

/**
 * Never overwrite a local copy that diverged from the last shared snapshot.
 * Hydrate only when this device has nothing, or it is still the copy we last synced.
 */
export function planSync(local: LocalSnapshot, remote: BackupFile | null, meta: SyncMeta | null): SyncPlan {
  if (!remote) return { kind: "offline" };
  const localData = localHasData(local);
  const remoteData = remoteHasData(remote);
  if (!localData && !remoteData) return { kind: "idle" };
  if (!localData && remoteData) return { kind: "hydrate", backup: remote };
  if (localData && !remoteData) return { kind: "upload" };

  if (!meta) return { kind: "conflict" };
  const localMoved = fingerprint(local.sets, local.sessions, local.settings) !== meta.fingerprint;
  const remoteMoved = remote.exportedAt !== meta.baseExportedAt;
  if (!localMoved && !remoteMoved) return { kind: "idle" };
  if (localMoved && !remoteMoved) return { kind: "upload" };
  if (!localMoved && remoteMoved) return { kind: "hydrate", backup: remote };
  return { kind: "conflict" };
}
