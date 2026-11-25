import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { DB_NAME, repo, resetRepoForTests } from "./db";
import { applyAttempt, createSession } from "./sessions";
import type { DictationSet, Prefs } from "./types";

const prefs: Prefs = { gender: "female", accent: "us", rate: 0.85 };
const set: DictationSet = {
  id: "set-1",
  title: "Week",
  createdAt: "2026-11-25T09:00:00.000Z",
  updatedAt: "2026-11-25T09:00:00.000Z",
  items: [
    { id: "a", body: "apple" },
    { id: "b", body: "because" },
  ],
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetRepoForTests();
});

describe("storage", () => {
  it("names the database letterbench", () => {
    expect(DB_NAME).toBe("letterbench");
  });

  it("saves sets, keeps finished results when a set is deleted, and replaces a backup", async () => {
    const store = await repo();
    await store.saveSet(set);
    const active = createSession(set, ["a", "b"], prefs);
    const finished = applyAttempt(
      applyAttempt(createSession(set, ["a"], prefs), { position: 0, letters: "apple", durationMs: 1000 }).session,
      { position: 0, letters: "apple", durationMs: 1000 },
    ).session;
    await store.saveSession(active);
    await store.saveSession(finished);
    await store.deleteSet(set.id);
    expect(await store.loadSets()).toEqual([]);
    const sessions = await store.loadSessions();
    expect(sessions.map((session) => session.id)).toEqual([finished.id]);

    await store.replaceAll([set], [active]);
    expect((await store.loadSets()).map((item) => item.id)).toEqual([set.id]);
    expect((await store.loadSessions()).map((item) => item.id)).toEqual([active.id]);
  });

  it("updates a session without dropping a previous attempt", async () => {
    const store = await repo();
    const session = createSession(set, ["a", "b"], prefs);
    await store.saveSession(session);
    await store.updateSession(session.id, (current) => applyAttempt(current, { position: 0, letters: "apple", durationMs: 500 }).session);
    await store.updateSession(session.id, (current) => ({ ...current, prefs: { ...prefs, rate: 1 } }));
    const saved = (await store.loadSessions())[0];
    expect(saved?.attempts).toHaveLength(1);
    expect(saved?.prefs.rate).toBe(1);
    expect(saved?.finishedAt).toBeNull();
  });
});
