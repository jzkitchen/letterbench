import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ResultSheet } from "../components/ResultSheet";
import { Loading, Shell } from "../components/Shell";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import type { Session } from "../lib/types";

export function ResultsPage() {
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

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="btn btn-ghost">
          Sets
        </Link>
        {session && !session.finishedAt ? (
          <Link to={`/practice/${sessionId}`} className="btn btn-secondary">
            Continue
          </Link>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      {missing ? <p>This result isn't here.</p> : null}
      {!session && !missing && !error ? <Loading label="Loading the result…" /> : null}
      {session?.finishedAt ? (
        <ResultSheet title={session.title} attempts={session.attempts} saved prefs={session.prefs} />
      ) : null}
      {session && !session.finishedAt ? <p className="text-sm text-muted">This dictation is not finished yet.</p> : null}
    </Shell>
  );
}
