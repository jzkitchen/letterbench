import type { Attempt, DictationSet, Prefs, Session, SetItem } from "./types";

export type LocalSnapshot = {
  sets: DictationSet[];
  sessions: Session[];
  settings: Prefs;
};

export type SyncDecision =
  | { kind: "offline" }
  | { kind: "idle" }
  | { kind: "apply"; merged: LocalSnapshot; writeLocal: boolean; upload: boolean };

type Stamped = { id: string; updatedAt: string; createdAt: string };

function later(left: Stamped, right: Stamped): boolean {
  const updated = left.updatedAt.localeCompare(right.updatedAt);
  if (updated !== 0) return updated > 0;
  return left.createdAt.localeCompare(right.createdAt) > 0;
}

function pickNewer<T extends Stamped>(local: T, remote: T): T {
  if (later(local, remote)) return local;
  if (later(remote, local)) return remote;
  return remote;
}

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

function canonicalSet(set: DictationSet): string {
  return JSON.stringify({
    id: set.id,
    title: set.title,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    items: set.items.map((item) => ({ id: item.id, body: item.body })),
  });
}

function canonicalSession(session: Session): string {
  return JSON.stringify({
    id: session.id,
    setId: session.setId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    finishedAt: session.finishedAt,
    items: session.items,
    attempts: session.attempts,
  });
}

function mergeItems(local: SetItem[], remote: SetItem[], base: SetItem[] | null, preferLocal: boolean): SetItem[] {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const baseMap = new Map((base ?? []).map((item) => [item.id, item]));
  const preferred = preferLocal ? local : remote;
  const other = preferLocal ? remote : local;
  const seen = new Set<string>();
  const merged: SetItem[] = [];
  for (const item of [...preferred, ...other]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const left = localMap.get(item.id);
    const right = remoteMap.get(item.id);
    const previous = baseMap.get(item.id);
    if (left && right) {
      merged.push(left.body === right.body || preferLocal ? left : right);
      continue;
    }
    const only = left ?? right;
    if (!only) continue;
    if (base && previous && previous.body === only.body && ((left && !right) || (right && !left))) continue;
    merged.push(only);
  }
  return merged;
}

function mergeSets(local: DictationSet[], remote: DictationSet[], base: DictationSet[] | null): DictationSet[] {
  const localMap = new Map(local.map((set) => [set.id, set]));
  const remoteMap = new Map(remote.map((set) => [set.id, set]));
  const baseMap = base ? new Map(base.map((set) => [set.id, set])) : null;
  const merged: DictationSet[] = [];
  for (const id of new Set([...localMap.keys(), ...remoteMap.keys()])) {
    const left = localMap.get(id);
    const right = remoteMap.get(id);
    const previous = baseMap?.get(id);
    if (left && right) {
      const winner = pickNewer(left, right);
      merged.push({
        ...winner,
        items: mergeItems(left.items, right.items, previous?.items ?? null, winner === left),
      });
      continue;
    }
    const only = left ?? right;
    if (!only || !previous) {
      if (only) merged.push(only);
      continue;
    }
    if ((left && canonicalSet(left) === canonicalSet(previous)) || (right && canonicalSet(right) === canonicalSet(previous))) {
      continue;
    }
    merged.push(only);
  }
  return merged;
}

function mergeAttempts(local: Attempt[], remote: Attempt[]): Attempt[] {
  const byPosition = new Map<number, Attempt>();
  for (const attempt of [...local, ...remote]) {
    const previous = byPosition.get(attempt.position);
    if (!previous || attempt.submittedAt >= previous.submittedAt) byPosition.set(attempt.position, attempt);
  }
  return [...byPosition.values()].sort((left, right) => left.position - right.position);
}

function mergeSessions(local: Session[], remote: Session[], base: Session[] | null): Session[] {
  const localMap = new Map(local.map((session) => [session.id, session]));
  const remoteMap = new Map(remote.map((session) => [session.id, session]));
  const baseMap = base ? new Map(base.map((session) => [session.id, session])) : null;
  const merged: Session[] = [];
  for (const id of new Set([...localMap.keys(), ...remoteMap.keys()])) {
    const left = localMap.get(id);
    const right = remoteMap.get(id);
    const previous = baseMap?.get(id);
    if (left && right) {
      const winner = pickNewer(left, right);
      merged.push({ ...winner, attempts: mergeAttempts(left.attempts, right.attempts) });
      continue;
    }
    const only = left ?? right;
    if (!only || !previous) {
      if (only) merged.push(only);
      continue;
    }
    if (
      (left && canonicalSession(left) === canonicalSession(previous)) ||
      (right && canonicalSession(right) === canonicalSession(previous))
    ) {
      continue;
    }
    merged.push(only);
  }
  return merged;
}

function mergeSettings(local: Prefs, remote: Prefs, base: Prefs | null): Prefs {
  const localJson = JSON.stringify(local);
  const remoteJson = JSON.stringify(remote);
  if (localJson === remoteJson) return local;
  if (!base) return local;
  const baseJson = JSON.stringify(base);
  if (localJson !== baseJson && remoteJson === baseJson) return local;
  if (remoteJson !== baseJson && localJson === baseJson) return remote;
  return local;
}

export function mergeSnapshots(local: LocalSnapshot, remote: LocalSnapshot, base: LocalSnapshot | null): LocalSnapshot {
  return {
    sets: mergeSets(local.sets, remote.sets, base?.sets ?? null),
    sessions: mergeSessions(local.sessions, remote.sessions, base?.sessions ?? null),
    settings: mergeSettings(local.settings, remote.settings, base?.settings ?? null),
  };
}

function unpublished(remote: { exportedAt: string; sets: DictationSet[]; sessions: Session[] }): boolean {
  return remote.exportedAt === "" && remote.sets.length === 0 && remote.sessions.length === 0;
}

export function decideSync(
  local: LocalSnapshot,
  remote: { exportedAt: string; sets: DictationSet[]; sessions: Session[]; settings: Prefs } | null,
  base: LocalSnapshot | null,
): SyncDecision {
  if (!remote) return { kind: "offline" };
  const remoteSnapshot: LocalSnapshot = { sets: remote.sets, sessions: remote.sessions, settings: remote.settings };
  const merged = unpublished(remote) ? local : mergeSnapshots(local, remoteSnapshot, base);
  const writeLocal = fingerprint(merged.sets, merged.sessions, merged.settings) !== fingerprint(local.sets, local.sessions, local.settings);
  const upload =
    fingerprint(merged.sets, merged.sessions, merged.settings) !==
    fingerprint(remoteSnapshot.sets, remoteSnapshot.sessions, remoteSnapshot.settings);
  if (!writeLocal && !upload) return { kind: "idle" };
  return { kind: "apply", merged, writeLocal, upload };
}
