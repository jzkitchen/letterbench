import type { Prefs } from "./types";

export const PREFS_KEY = "letterbench-prefs";

export const DEFAULT_PREFS: Prefs = {
  gender: "female",
  accent: "us",
  rate: 0.85,
};

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_PREFS.rate;
  const stepped = Math.round(rate * 20) / 20;
  return Math.min(1.3, Math.max(0.6, stepped));
}

export function normalizePrefs(value: unknown): Prefs | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const gender = record.gender === "male" || record.gender === "female" ? record.gender : null;
  const accent = record.accent === "uk" || record.accent === "us" ? record.accent : null;
  if (!gender || !accent) return null;
  const rate = typeof record.rate === "number" ? record.rate : Number(record.rate);
  return { gender, accent, rate: clampRate(rate) };
}

export function readPrefs(): Prefs {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_PREFS;
    return normalizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "")) ?? DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: Prefs): void {
  if (typeof localStorage === "undefined") return;
  const next = normalizePrefs(prefs) ?? DEFAULT_PREFS;
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}
