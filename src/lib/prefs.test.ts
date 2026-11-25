import { afterEach, describe, expect, it } from "vitest";
import { clampRate, DEFAULT_PREFS, normalizePrefs, PREFS_KEY, readPrefs, writePrefs } from "./prefs";

const memory = new Map<string, string>();

afterEach(() => {
  memory.clear();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("prefs", () => {
  it("uses the letterbench-prefs key and the documented defaults", () => {
    expect(PREFS_KEY).toBe("letterbench-prefs");
    expect(DEFAULT_PREFS).toEqual({ gender: "female", accent: "us", rate: 0.85 });
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("clamps and steps the rate", () => {
    expect(clampRate(0.85)).toBe(0.85);
    expect(clampRate(2)).toBe(1.3);
    expect(clampRate(0.1)).toBe(0.6);
    expect(clampRate(Number.NaN)).toBe(0.85);
    expect(normalizePrefs({ gender: "male", accent: "uk", rate: "1" })).toEqual({
      gender: "male",
      accent: "uk",
      rate: 1,
    });
    expect(normalizePrefs({ gender: "other", accent: "us", rate: 1 })).toBeNull();
  });

  it("persists a normalized object", () => {
    const store = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
    writePrefs({ gender: "male", accent: "uk", rate: 1.04 });
    expect(JSON.parse(memory.get(PREFS_KEY) ?? "")).toEqual({ gender: "male", accent: "uk", rate: 1.05 });
    expect(readPrefs()).toEqual({ gender: "male", accent: "uk", rate: 1.05 });
  });
});
