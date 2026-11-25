import { createId } from "./ids";
import { normalizePrompt } from "./puzzle";
import { clampRate, normalizePrefs } from "./prefs";
import type { Attempt, DictationSet, Prefs, Session, SessionItem } from "./types";

export const BACKUP_VERSION = 1;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export type BackupFile = {
  version: 1;
  app: "letterbench";
  exportedAt: string;
  settings: Prefs;
  sets: DictationSet[];
  sessions: Session[];
  results: Session[];
};

export type ImportPlan = {
  sets: DictationSet[];
  sessions: Session[];
  settings: Prefs | null;
  replaceSets: boolean;
  replaceSessions: boolean;
  warnings: string[];
};

const MAX_BYTES = 2_000_000;

export function buildBackup(
  sets: DictationSet[],
  sessions: Session[],
  settings: Prefs,
  now = new Date(),
): BackupFile {
  const results = sessions
    .filter((session) => session.finishedAt != null)
    .sort((left, right) => (right.finishedAt ?? "").localeCompare(left.finishedAt ?? ""));
  return {
    version: BACKUP_VERSION,
    app: "letterbench",
    exportedAt: now.toISOString(),
    settings,
    sets,
    sessions,
    results,
  };
}

export function backupFilename(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `letterbench-backup-${year}-${month}-${day}.json`;
}

export function planSummary(plan: ImportPlan): string {
  const finished = plan.sessions.filter((session) => session.finishedAt).length;
  const active = plan.sessions.length - finished;
  const parts: string[] = [];
  if (plan.replaceSets) parts.push(`${plan.sets.length} ${plan.sets.length === 1 ? "set" : "sets"}`);
  if (plan.replaceSessions) {
    parts.push(`${finished} ${finished === 1 ? "result" : "results"}`);
    parts.push(`${active} in progress`);
  }
  if (plan.settings) parts.push("voice settings");
  return parts.join(", ") || "nothing";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asIso(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function readItemBody(value: unknown): string | null {
  if (typeof value === "string") return normalizePrompt(value);
  if (!isRecord(value)) return null;
  const raw = value.body ?? value.text ?? value.prompt ?? value.line;
  return typeof raw === "string" ? normalizePrompt(raw) : null;
}

function readSets(value: unknown, warnings: string[], now: string): DictationSet[] {
  if (!Array.isArray(value)) return [];
  const sets: DictationSet[] = [];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      warnings.push(`Skipped set ${index + 1} because it was not an object.`);
      return;
    }
    const titleSource = typeof entry.title === "string" ? entry.title : typeof entry.name === "string" ? entry.name : "";
    let title = titleSource.trim().replace(/\s+/g, " ");
    if (!title) {
      warnings.push("Skipped a set with no name.");
      return;
    }
    if (title.length > 80) {
      warnings.push(`Shortened the name of “${title.slice(0, 40)}”.`);
      title = title.slice(0, 80);
    }
    const rawItems = Array.isArray(entry.items) ? entry.items : Array.isArray(entry.lines) ? entry.lines : [];
    const pairs: { id: string | null; body: string }[] = [];
    for (const item of rawItems) {
      const body = readItemBody(item);
      if (!body) continue;
      if (body.length > 280 || !/[a-zA-Z]/.test(body)) {
        warnings.push(`Skipped a line in “${title}”.`);
        continue;
      }
      pairs.push({ id: isRecord(item) ? asString(item.id) : null, body });
    }
    if (pairs.length > 200) {
      warnings.push(`“${title}” was cut to 200 lines.`);
      pairs.length = 200;
    }
    if (pairs.length === 0) {
      warnings.push(`Skipped “${title}” (no usable lines).`);
      return;
    }
    const items = pairs.map((pair) => ({ id: pair.id ?? createId(), body: pair.body }));
    sets.push({
      id: asString(entry.id) ?? createId(),
      title,
      createdAt: asIso(entry.createdAt, now),
      updatedAt: asIso(entry.updatedAt, now),
      items,
    });
  });
  return sets;
}

function readAttempt(value: unknown, prompt: string, now: string): Attempt | null {
  if (!isRecord(value)) return null;
  const position = typeof value.position === "number" ? value.position : Number(value.position);
  if (!Number.isInteger(position) || position < 0) return null;
  const letters = typeof value.letters === "string" ? value.letters : typeof value.answer === "string" ? value.answer : "";
  const answer = typeof value.answer === "string" ? value.answer : letters;
  const attemptPrompt = typeof value.prompt === "string" ? normalizePrompt(value.prompt) : prompt;
  const duration = typeof value.durationMs === "number" ? value.durationMs : Number(value.durationMs);
  return {
    position,
    prompt: attemptPrompt || prompt,
    answer,
    letters,
    correct: value.correct === true,
    durationMs: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0,
    submittedAt: asIso(value.submittedAt, now),
  };
}

function readSession(value: unknown, warnings: string[], now: string, settings: Prefs): Session | null {
  if (!isRecord(value)) return null;
  const titleSource = typeof value.title === "string" ? value.title.trim().replace(/\s+/g, " ") : "";
  const title = (titleSource || "Dictation").slice(0, 80);
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items: SessionItem[] = [];
  rawItems.forEach((entry, index) => {
    const prompt = readItemBody(entry);
    if (!prompt || !/[a-zA-Z]/.test(prompt)) return;
    const position = isRecord(entry) && typeof entry.position === "number" ? entry.position : index;
    const itemId = isRecord(entry) ? asString(entry.itemId ?? entry.id) : null;
    items.push({ position, itemId, prompt });
  });
  items.sort((left, right) => left.position - right.position);
  const rawAttempts = Array.isArray(value.attempts) ? value.attempts : [];
  const attempts = rawAttempts
    .map((attempt) => readAttempt(attempt, "", now))
    .filter((attempt): attempt is Attempt => attempt != null)
    .sort((left, right) => left.position - right.position);
  if (items.length === 0 && attempts.length > 0) {
    for (const attempt of attempts) {
      if (!attempt.prompt) continue;
      items.push({ position: attempt.position, itemId: null, prompt: attempt.prompt });
    }
  }
  if (items.length === 0) {
    warnings.push(`Skipped a session (${title}) with no lines.`);
    return null;
  }
  const prefs = normalizePrefs(value.prefs) ?? settings;
  const createdAt = asIso(value.createdAt, now);
  const updatedAt = asIso(value.updatedAt, createdAt);
  let finishedAt: string | null = null;
  if (typeof value.finishedAt === "string") finishedAt = asIso(value.finishedAt, updatedAt);
  else if (value.finished === true || value.status === "finished") finishedAt = updatedAt;
  const done = new Set(attempts.map((attempt) => attempt.position));
  if (!finishedAt && items.every((item) => done.has(item.position))) finishedAt = updatedAt;
  return {
    id: asString(value.id) ?? createId(),
    setId: asString(value.setId ?? value.collectionId),
    title,
    createdAt,
    updatedAt,
    finishedAt,
    prefs,
    items,
    attempts,
  };
}

export function parseBackup(input: unknown, now = new Date()): ImportPlan {
  if (!isRecord(input)) throw new BackupError("This file is not a Letterbench backup.");
  const recognized = [
    "version",
    "app",
    "settings",
    "prefs",
    "preferences",
    "sets",
    "collections",
    "sessions",
    "results",
    "inProgress",
  ].some((key) => key in input);
  if (!recognized) throw new BackupError("This file is not a Letterbench backup.");

  const warnings: string[] = [];
  if (input.app != null && input.app !== "letterbench") {
    warnings.push("The file was not marked as a Letterbench backup. Known fields were still read.");
  }
  const iso = now.toISOString();
  const settings =
    normalizePrefs(input.settings) ?? normalizePrefs(input.prefs) ?? normalizePrefs(input.preferences);
  const fallbackPrefs = settings ?? { gender: "female" as const, accent: "us" as const, rate: clampRate(0.85) };
  const setsKey = "sets" in input || "collections" in input;
  const sessionsKey = "sessions" in input || "results" in input || "inProgress" in input;
  const sets = setsKey ? readSets(input.sets ?? input.collections, warnings, iso) : [];
  const sessionSources = [
    ...(Array.isArray(input.sessions) ? input.sessions : []),
    ...(Array.isArray(input.results) ? input.results : []),
    ...(Array.isArray(input.inProgress) ? input.inProgress : []),
  ];
  const sessions: Session[] = [];
  const seen = new Set<string>();
  if (sessionsKey) {
    for (const source of sessionSources) {
      const session = readSession(source, warnings, iso, fallbackPrefs);
      if (!session || seen.has(session.id)) continue;
      seen.add(session.id);
      sessions.push(session);
    }
  }
  if (!setsKey && !sessionsKey && !settings) {
    throw new BackupError("This backup has no settings, sets, or sessions.");
  }
  return {
    sets,
    sessions,
    settings,
    replaceSets: setsKey,
    replaceSessions: sessionsKey,
    warnings,
  };
}

export function parseBackupText(text: string, now = new Date()): ImportPlan {
  if (text.length > MAX_BYTES) throw new BackupError("That backup is too large.");
  try {
    return parseBackup(JSON.parse(text) as unknown, now);
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("This file is not valid JSON.");
  }
}
