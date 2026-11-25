import { describe, expect, it } from "vitest";
import { applyAttempt, createSession, summarize } from "./sessions";
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

describe("sessions", () => {
  it("keeps selected lines in set order and scores them", () => {
    const session = createSession(set, ["b", "a"], prefs, new Date("2026-11-25T09:01:00.000Z"));
    expect(session.items.map((item) => item.prompt)).toEqual(["apple", "because"]);
    const first = applyAttempt(session, { position: 0, letters: "apple", durationMs: 1200 }, new Date("2026-11-25T09:02:00.000Z"));
    expect(first.result).toMatchObject({ ok: true, correct: true, finished: false, attempts: null });
    const second = applyAttempt(
      first.session,
      { position: 1, letters: "becuase", durationMs: 3400 },
      new Date("2026-11-25T09:03:00.000Z"),
    );
    expect(second.result).toMatchObject({ ok: true, correct: false, finished: true });
    expect(second.session.finishedAt).toBe("2026-11-25T09:03:00.000Z");
    if (second.result.ok) expect(second.result.attempts).toHaveLength(2);
  });

  it("summarizes in-progress work, last scores, and recent results", () => {
    const session = createSession(set, ["a", "b"], prefs, new Date("2026-11-25T09:01:00.000Z"));
    const done = applyAttempt(
      applyAttempt(session, { position: 0, letters: "apple", durationMs: 1000 }).session,
      { position: 1, letters: "because", durationMs: 2000 },
    ).session;
    const open = createSession(set, ["a"], prefs, new Date("2026-11-25T10:00:00.000Z"));
    const home = summarize([set], [done, open]);
    expect(home.inProgress.map((item) => item.id)).toEqual([open.id]);
    expect(home.collections[0]).toMatchObject({ lastCorrect: 2, lastTotal: 2, itemCount: 2 });
    expect(home.recent[0]).toMatchObject({ correctCount: 2, itemCount: 2, totalMs: 3000 });
  });

  it("lists sets newest first, using createdAt when updatedAt matches", () => {
    const editedLater = {
      ...set,
      id: "edited",
      title: "Edited",
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-25T12:00:00.000Z",
    };
    const createdSameDay = {
      ...set,
      id: "same-day",
      title: "Same day",
      createdAt: "2026-11-20T08:00:00.000Z",
      updatedAt: "2026-11-20T08:00:00.000Z",
    };
    const createdEarlierSameUpdate = {
      ...set,
      id: "earlier",
      title: "Earlier",
      createdAt: "2026-11-10T08:00:00.000Z",
      updatedAt: "2026-11-20T08:00:00.000Z",
    };
    const home = summarize([createdEarlierSameUpdate, createdSameDay, editedLater], []);
    expect(home.collections.map((item) => item.id)).toEqual(["edited", "same-day", "earlier"]);
  });
});
