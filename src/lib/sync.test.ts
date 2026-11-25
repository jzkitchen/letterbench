import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./prefs";
import { decideSync, type LocalSnapshot } from "./sync";
import type { DictationSet, Session } from "./types";

const settings = DEFAULT_PREFS;

function set(id: string, updatedAt: string, body = "apple", createdAt = "2026-11-01T00:00:00.000Z"): DictationSet {
  return {
    id,
    title: id,
    createdAt,
    updatedAt,
    items: [{ id: `${id}-item`, body }],
  };
}

function snap(sets: DictationSet[], sessions: Session[] = [], prefs = settings): LocalSnapshot {
  return { sets, sessions, settings: prefs };
}

function remote(sets: DictationSet[], exportedAt = "2026-11-25T00:00:00.000Z", sessions: Session[] = []) {
  return { exportedAt, sets, sessions, settings };
}

describe("automatic sync", () => {
  it("loads the online store onto an empty device", () => {
    const week = set("week", "2026-11-25T09:00:00.000Z");
    const decision = decideSync(snap([]), remote([week]), null);
    expect(decision.kind).toBe("apply");
    if (decision.kind === "apply") {
      expect(decision.merged.sets.map((item) => item.id)).toEqual(["week"]);
      expect(decision.writeLocal).toBe(true);
      expect(decision.upload).toBe(false);
    }
  });

  it("uploads this device when the online store is still empty", () => {
    const decision = decideSync(snap([set("week", "2026-11-25T09:00:00.000Z")]), remote([], ""), null);
    expect(decision.kind).toBe("apply");
    if (decision.kind === "apply") {
      expect(decision.writeLocal).toBe(false);
      expect(decision.upload).toBe(true);
    }
  });

  it("keeps both devices' sets and the newer edit of a shared set", () => {
    const base = snap([set("shared", "2026-11-20T00:00:00.000Z", "apple")]);
    const local = snap([
      set("shared", "2026-11-25T12:00:00.000Z", "pear"),
      set("local-only", "2026-11-25T12:00:00.000Z", "cat"),
    ]);
    const online = remote([
      set("shared", "2026-11-24T12:00:00.000Z", "plum"),
      set("remote-only", "2026-11-24T12:00:00.000Z", "dog"),
    ]);
    const decision = decideSync(local, online, base);
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    const shared = decision.merged.sets.find((item) => item.id === "shared");
    expect(shared?.items[0]?.body).toBe("pear");
    expect(decision.merged.sets.map((item) => item.id).sort()).toEqual(["local-only", "remote-only", "shared"]);
    expect(decision.writeLocal).toBe(true);
    expect(decision.upload).toBe(true);
  });

  it("drops a set deleted here when the online copy has not changed it", () => {
    const original = set("week", "2026-11-20T00:00:00.000Z");
    const decision = decideSync(snap([]), remote([original]), snap([original]));
    expect(decision.kind).toBe("apply");
    if (decision.kind === "apply") {
      expect(decision.merged.sets).toEqual([]);
      expect(decision.upload).toBe(true);
    }
  });

  it("keeps a remote edit over a local delete of the same set", () => {
    const original = set("week", "2026-11-20T00:00:00.000Z", "apple");
    const edited = set("week", "2026-11-25T12:00:00.000Z", "pear");
    const decision = decideSync(snap([]), remote([edited]), snap([original]));
    expect(decision.kind).toBe("apply");
    if (decision.kind === "apply") expect(decision.merged.sets[0]?.items[0]?.body).toBe("pear");
  });

  it("does nothing when the copies already match", () => {
    const week = set("week", "2026-11-20T00:00:00.000Z");
    expect(decideSync(snap([week]), remote([week]), snap([week])).kind).toBe("idle");
  });
});
