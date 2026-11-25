import { describe, expect, it } from "vitest";
import { BackupError, buildBackup, parseBackup, parseBackupText } from "./backup";
import { createSession } from "./sessions";
import type { DictationSet, Prefs } from "./types";

const settings: Prefs = { gender: "male", accent: "uk", rate: 1 };
const set: DictationSet = {
  id: "set-1",
  title: "Week",
  createdAt: "2026-11-25T09:00:00.000Z",
  updatedAt: "2026-11-25T09:00:00.000Z",
  items: [{ id: "item-1", body: "apple" }],
};

describe("backup", () => {
  it("round-trips settings, sets, and sessions", () => {
    const session = createSession(set, ["item-1"], settings, new Date("2026-11-25T09:01:00.000Z"));
    const file = buildBackup([set], [session], settings, new Date("2026-11-25T09:05:00.000Z"));
    expect(file.version).toBe(1);
    expect(file.app).toBe("letterbench");
    expect(file.results).toEqual([]);
    const plan = parseBackup(JSON.parse(JSON.stringify(file)) as unknown);
    expect(plan.warnings).toEqual([]);
    expect(plan.settings).toEqual(settings);
    expect(plan.sets).toEqual([set]);
    expect(plan.sessions).toEqual([session]);
    expect(plan.replaceSets).toBe(true);
    expect(plan.replaceSessions).toBe(true);
  });

  it("accepts collection aliases and string lines", () => {
    const plan = parseBackup({
      collections: [{ name: "Week", lines: ["apple", "because"] }],
      prefs: { gender: "female", accent: "us", rate: 0.85 },
    });
    expect(plan.sets).toHaveLength(1);
    expect(plan.sets[0]?.items.map((item) => item.body)).toEqual(["apple", "because"]);
    expect(plan.settings).toEqual({ gender: "female", accent: "us", rate: 0.85 });
    expect(plan.replaceSessions).toBe(false);
  });

  it("keeps a finished result that only lists attempts", () => {
    const plan = parseBackup({
      results: [
        {
          id: "result-1",
          collectionId: "set-1",
          title: "Week",
          finishedAt: "2026-11-25T09:29:00.000Z",
          attempts: [{ position: 0, prompt: "apple", answer: "bpple", letters: "bpple", correct: false, durationMs: 1500 }],
        },
      ],
    });
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({
      id: "result-1",
      setId: "set-1",
      finishedAt: "2026-11-25T09:29:00.000Z",
    });
    expect(plan.sessions[0]?.items[0]?.prompt).toBe("apple");
  });

  it("rejects a file that is not a backup", () => {
    expect(() => parseBackup({ hello: "world" })).toThrow(BackupError);
    expect(() => parseBackupText("{")).toThrow(/valid JSON/);
  });
});
