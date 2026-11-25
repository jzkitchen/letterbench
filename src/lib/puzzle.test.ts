import { describe, expect, it } from "vitest";
import { buildPuzzle, grade, letterCount, normalizePrompt, parseLines, parseTitle } from "./puzzle";

describe("prompts", () => {
  it("normalizes curly quotes and spacing", () => {
    expect(normalizePrompt("  Don’t   “go” — now  ")).toBe(`Don't "go" - now`);
  });

  it("grades letters only and keeps the original shape", () => {
    expect(grade("Apple!", "apple")).toEqual({ correct: true, answer: "Apple!" });
    expect(grade("Apple!", "bpple")).toEqual({ correct: false, answer: "Bpple!" });
    expect(grade("I like reading.", "ilikereading")).toEqual({ correct: true, answer: "I like reading." });
    expect(grade("I like reading.", "ilikereadinx")).toEqual({ correct: false, answer: "I like readinx." });
    expect(grade("Don’t", "dont")).toEqual({ correct: true, answer: "Don't" });
  });

  it("builds tiles for every letter plus distractors", () => {
    const puzzle = buildPuzzle("apple", () => 0);
    const chars = puzzle.tiles.map((tile) => tile.char);
    expect(letterCount(puzzle.slots)).toBe(5);
    expect(chars.filter((char) => char === "p")).toHaveLength(2);
    expect(puzzle.tiles).toHaveLength(9);
    expect(chars).toEqual([...chars].sort());
    expect(new Set(puzzle.tiles.map((tile) => tile.id)).size).toBe(puzzle.tiles.length);
    expect(chars.filter((char) => !"aple".includes(char))).toHaveLength(4);
  });

  it("keeps spaces and punctuation out of the blanks", () => {
    const puzzle = buildPuzzle("I like reading.");
    expect(puzzle.slots.filter((slot) => slot.kind === "gap")).toHaveLength(2);
    expect(puzzle.slots.at(-1)).toEqual({ kind: "fixed", char: "." });
    expect(letterCount(puzzle.slots)).toBe(12);
  });

  it("validates set names and lines", () => {
    expect(parseTitle("  ")).toEqual({ title: "", error: "Give this set a name." });
    expect(parseTitle("Week 1")).toEqual({ title: "Week 1", error: null });
    expect(parseLines(["", "apple", "   "]).items).toEqual(["apple"]);
    expect(parseLines(["..."]).error).toMatch(/English letter/);
    expect(parseLines([]).error).toMatch(/at least one/);
  });
});
