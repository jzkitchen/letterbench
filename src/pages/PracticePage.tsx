import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PracticeBoard } from "../components/PracticeBoard";
import { ResultSheet } from "../components/ResultSheet";
import { Loading, Shell } from "../components/Shell";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import { writePrefs } from "../lib/prefs";
import { applyAttempt, resumeIndex } from "../lib/sessions";
import { scheduleSync, syncNow } from "../lib/sync-client";
import type { Prefs, Session } from "../lib/types";

export function PracticePage() {
  const { sessionId = "" } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    repo()
      .then((store) => store.loadSessions())
      .then((sessions) => {
        if (cancel) return;
        const found = sessions.find((entry) => entry.id === sessionId) ?? null;
        if (!found) setMissing(true);
        else setSession(found);
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(messageOf(reason));
      });
    return () => {
      cancel = true;
    };
  }, [sessionId]);

  function onPrefs(next: Prefs) {
    writePrefs(next);
    setSession((current) => (current ? { ...current, prefs: next } : current));
    void repo()
      .then((store) =>
        store.updateSession(sessionId, (current) => ({
          ...current,
          prefs: next,
          updatedAt: new Date().toISOString(),
        })),
      )
      .then(() => scheduleSync());
  }

  const start = session ? resumeIndex(session) : -1;
  const finished = Boolean(session?.finishedAt) || (session != null && start < 0 && session.items.length > 0);

  return (
    <Shell>
      <div className="mb-4">
        {session?.setId ? (
          <Link to={`/sets/${session.setId}`} className="btn btn-ghost">
            Exit
          </Link>
        ) : (
          <Link to="/" className="btn btn-ghost">
            Exit
          </Link>
        )}
      </div>
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      {missing ? <p>This dictation isn't here.</p> : null}
      {!session && !missing && !error ? <Loading label="Loading the dictation…" /> : null}
      {session && finished ? (
        <ResultSheet title={session.title} attempts={session.attempts} saved prefs={session.prefs} />
      ) : null}
      {session && !finished ? (
        <PracticeBoard
          title={session.title}
          items={session.items}
          startIndex={start}
          prefs={session.prefs}
          saved
          onPrefs={onPrefs}
          onAttempt={async (input) => {
            const store = await repo();
            const saved = await store.updateSession(sessionId, (current) => applyAttempt(current, input).session);
            const attempt = saved?.attempts.find((entry) => entry.position === input.position);
            if (!saved || !attempt) return { ok: false, error: "This dictation isn't here." };
            await syncNow();
            const finished = saved.finishedAt != null;
            return {
              ok: true,
              correct: attempt.correct,
              answer: attempt.answer,
              prompt: attempt.prompt,
              finished,
              attempts: finished ? saved.attempts : null,
            };
          }}
        />
      ) : null}
    </Shell>
  );
}
