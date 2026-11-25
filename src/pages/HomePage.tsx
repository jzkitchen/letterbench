import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BackupPanel } from "../components/BackupPanel";
import { Loading, Shell } from "../components/Shell";
import { repo } from "../lib/db";
import { formatDuration, formatWhen, messageOf } from "../lib/format";
import { summarize } from "../lib/sessions";
import { syncNow } from "../lib/sync-client";
import type { HomeData } from "../lib/types";

export function HomePage() {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setError(null);
    repo()
      .then(async (store) => {
        await syncNow();
        const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
        return summarize(sets, sessions);
      })
      .then((home) => {
        if (!cancel) setData(home);
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(messageOf(reason));
      });
    return () => {
      cancel = true;
    };
  }, [tick]);

  useEffect(() => {
    const reload = () => setTick((value) => value + 1);
    window.addEventListener("letterbench-synced", reload);
    return () => window.removeEventListener("letterbench-synced", reload);
  }, []);

  async function discard(id: string) {
    try {
      const store = await repo();
      await store.deleteSession(id);
      await syncNow();
      setTick((value) => value + 1);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <Shell>
      {error ? (
        <div className="grid gap-3">
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setTick((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : null}
      {!data && !error ? <Loading label="Loading your sets…" /> : null}
      {data ? (
        <div className="grid gap-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl font-medium tracking-tight">Your sets</h1>
              <p className="text-sm text-muted">Kept on this device. A sample round is not saved.</p>
            </div>
            <Link to="/sets/new" className="btn btn-primary">
              New set
            </Link>
          </div>
          {data.inProgress.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-sm font-medium text-muted">In progress</h2>
              {data.inProgress.map((session) => (
                <div className="panel flex flex-wrap items-center justify-between gap-3" key={session.id}>
                  <div>
                    <p className="font-medium">{session.title}</p>
                    <p className="nums text-sm text-muted">
                      {session.done} of {session.itemCount} submitted
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost" onClick={() => void discard(session.id)}>
                      Discard
                    </button>
                    <Link to={`/practice/${session.id}`} className="btn btn-secondary">
                      Continue
                    </Link>
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {data.collections.length === 0 ? (
            <div className="panel grid gap-3">
              <p>No sets yet. Add the words or sentences you want read aloud.</p>
              <Link to="/sample" className="btn btn-secondary w-full">
                Try a sample round
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {data.collections.map((set) => (
                <li key={set.id}>
                  <Link to={`/sets/${set.id}`} className="panel grid gap-1">
                    <span className="font-medium">{set.title}</span>
                    <span className="text-sm text-muted">
                      {set.itemCount} {set.itemCount === 1 ? "line" : "lines"}
                      {set.lastCorrect != null && set.lastTotal != null
                        ? ` · Last score ${set.lastCorrect}/${set.lastTotal}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.recent.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-sm font-medium text-muted">Recent results</h2>
              <ul className="grid gap-2">
                {data.recent.map((result) => (
                  <li key={result.id}>
                    <Link
                      to={`/results/${result.id}`}
                      className="result-link flex items-baseline justify-between gap-3 border-b py-3"
                    >
                      <span>
                        <span className="block font-medium">{result.title}</span>
                        <span className="text-sm text-muted">{formatWhen(result.finishedAt)}</span>
                      </span>
                      <span className="nums text-sm">
                        {result.correctCount}/{result.itemCount}
                        <span className="text-muted"> · {formatDuration(result.totalMs)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <BackupPanel onRestored={() => setTick((value) => value + 1)} />
          <Link to="/sample" className="text-sm font-medium text-muted">
            Sample round, not saved
          </Link>
        </div>
      ) : null}
    </Shell>
  );
}
