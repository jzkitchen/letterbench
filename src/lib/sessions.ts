import { createId } from "./ids";
import { grade } from "./puzzle";
import type {
  Attempt,
  AttemptRequest,
  AttemptResponse,
  DictationSet,
  HomeData,
  Prefs,
  Session,
} from "./types";

export function resumeIndex(session: Session): number {
  const done = new Set(session.attempts.map((attempt) => attempt.position));
  return session.items.findIndex((item) => !done.has(item.position));
}

export function isComplete(session: Session): boolean {
  return session.items.length > 0 && resumeIndex(session) === -1;
}

export function createSession(
  set: DictationSet,
  itemIds: string[],
  prefs: Prefs,
  now = new Date(),
): Session {
  const chosen = new Set(itemIds);
  const items = set.items.filter((item) => chosen.has(item.id));
  if (items.length === 0) throw new Error("Choose at least one line.");
  const iso = now.toISOString();
  return {
    id: createId(),
    setId: set.id,
    title: set.title,
    createdAt: iso,
    updatedAt: iso,
    finishedAt: null,
    prefs,
    items: items.map((item, position) => ({ position, itemId: item.id, prompt: item.body })),
    attempts: [],
  };
}

function durationOf(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms));
}

export function applyAttempt(session: Session, input: AttemptRequest, now = new Date()): {
  session: Session;
  result: AttemptResponse;
} {
  if (session.finishedAt) {
    return { session, result: { ok: false, error: "This dictation is already finished." } };
  }
  const item = session.items.find((entry) => entry.position === input.position);
  if (!item) return { session, result: { ok: false, error: "That line isn't in this dictation." } };
  const graded = grade(item.prompt, input.letters);
  const attempt: Attempt = {
    position: item.position,
    prompt: item.prompt,
    answer: graded.answer,
    letters: input.letters,
    correct: graded.correct,
    durationMs: durationOf(input.durationMs),
    submittedAt: now.toISOString(),
  };
  const attempts = [...session.attempts.filter((entry) => entry.position !== attempt.position), attempt].sort(
    (left, right) => left.position - right.position,
  );
  const next: Session = {
    ...session,
    attempts,
    updatedAt: attempt.submittedAt,
    finishedAt: null,
  };
  const finished = isComplete(next);
  if (finished) next.finishedAt = attempt.submittedAt;
  return {
    session: next,
    result: {
      ok: true,
      correct: graded.correct,
      answer: graded.answer,
      prompt: item.prompt,
      finished,
      attempts: finished ? attempts : null,
    },
  };
}

function byNewest(left: { updatedAt: string; createdAt: string }, right: { updatedAt: string; createdAt: string }): number {
  const updated = right.updatedAt.localeCompare(left.updatedAt);
  if (updated !== 0) return updated;
  return right.createdAt.localeCompare(left.createdAt);
}

export function summarize(sets: DictationSet[], sessions: Session[]): HomeData {
  const inProgress = sessions
    .filter((session) => session.finishedAt == null)
    .map((session) => ({
      id: session.id,
      title: session.title,
      done: session.attempts.length,
      itemCount: session.items.length,
      updatedAt: session.updatedAt,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const collections = [...sets].sort(byNewest).map((set) => {
      const latest = sessions
        .filter((session) => session.setId === set.id && session.finishedAt)
        .sort((left, right) => (right.finishedAt ?? "").localeCompare(left.finishedAt ?? ""))[0];
      return {
        id: set.id,
        title: set.title,
        itemCount: set.items.length,
        updatedAt: set.updatedAt,
        lastCorrect: latest ? latest.attempts.filter((attempt) => attempt.correct).length : null,
        lastTotal: latest ? latest.items.length : null,
      };
    });

  const recent = sessions
    .filter((session): session is Session & { finishedAt: string } => session.finishedAt != null)
    .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))
    .slice(0, 20)
    .map((session) => ({
      id: session.id,
      title: session.title,
      finishedAt: session.finishedAt,
      correctCount: session.attempts.filter((attempt) => attempt.correct).length,
      itemCount: session.items.length,
      totalMs: session.attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0),
    }));

  return { inProgress, collections, recent };
}
