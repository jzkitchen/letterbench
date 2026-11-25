import { describe, expect, it } from "vitest";
import { buildBackup } from "./backup";
import { DEFAULT_PREFS } from "./prefs";
import { fingerprint, planSync, type LocalSnapshot, type SyncMeta } from "./sync";
import type { DictationSet } from "./types";

const settings = DEFAULT_PREFS;

function set(id: string, updatedAt: string, createdAt = updatedAt): DictationSet {
  return {
    id,
    title: id,
    createdAt,
    updatedAt,
    items: [{ id: `${id}-item`, body: "apple" }],
  };
}

function local(sets: DictationSet[], prefs = settings): LocalSnapshot {
  return { sets, sessions: [], settings: prefs };
}

function remoteFrom(sets: DictationSet[], exportedAt: string) {
  return { ...buildBackup(sets, [], settings, new Date(exportedAt)), exportedAt };
}

describe("sync plan", () => {
  it("hydrates an empty device from the public copy", () => {
    const remote = remoteFrom([set("week", "2026-11-25T09:00:00.000Z")], "2026-11-25T09:30:00.000Z");
    expect(planSync(local([]), remote, null)).toEqual({ kind: "hydrate", backup: remote });
  });

  it("does not replace local sets with an empty online copy", () => {
    const remote = { ...buildBackup([], [], settings, new Date(0)), exportedAt: "" };
    expect(planSync(local([set("week", "2026-11-25T09:00:00.000Z")]), remote, null).kind).toBe("upload");
  });

  it("asks for an explicit choice when both copies changed", () => {
    const base = "2026-11-20T00:00:00.000Z";
    const original = [set("week", base)];
    const meta: SyncMeta = { baseExportedAt: base, fingerprint: fingerprint(original, [], settings) };
    const localSets = [set("week", "2026-11-25T12:00:00.000Z", base)];
    const remote = remoteFrom([set("week", "2026-11-24T12:00:00.000Z", base), set("other", "2026-11-24T12:00:00.000Z")], "2026-11-24T13:00:00.000Z");
    expect(planSync(local(localSets), remote, meta).kind).toBe("conflict");
  });

  it("uploads when only this device changed since the last sync", () => {
    const base = "2026-11-20T00:00:00.000Z";
    const original = [set("week", base)];
    const meta: SyncMeta = { baseExportedAt: base, fingerprint: fingerprint(original, [], settings) };
    const remote = remoteFrom(original, base);
    const changed = local([set("week", "2026-11-25T12:00:00.000Z", base)]);
    expect(planSync(changed, remote, meta).kind).toBe("upload");
  });

  it("refreshes a clean device when the online copy is newer", () => {
    const base = "2026-11-20T00:00:00.000Z";
    const original = [set("week", base)];
    const meta: SyncMeta = { baseExportedAt: base, fingerprint: fingerprint(original, [], settings) };
    const remote = remoteFrom([set("week", "2026-11-25T12:00:00.000Z", base)], "2026-11-25T12:05:00.000Z");
    expect(planSync(local(original), remote, meta).kind).toBe("hydrate");
  });

  it("leaves both alone when they still match", () => {
    const stamp = "2026-11-20T00:00:00.000Z";
    const sets = [set("week", stamp)];
    const meta: SyncMeta = { baseExportedAt: stamp, fingerprint: fingerprint(sets, [], settings) };
    expect(planSync(local(sets), remoteFrom(sets, stamp), meta).kind).toBe("idle");
  });
});
