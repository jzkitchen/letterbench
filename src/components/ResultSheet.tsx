import { VolumeIcon } from "./Icons";
import { formatDuration } from "../lib/format";
import { speak } from "../lib/speech";
import { useVoices } from "../lib/useVoices";
import type { Attempt, Prefs } from "../lib/types";

export function ResultSheet({
  title,
  attempts,
  saved,
  prefs,
}: {
  title: string;
  attempts: Attempt[];
  saved: boolean;
  prefs: Prefs;
}) {
  const { voices } = useVoices();
  const correct = attempts.filter((attempt) => attempt.correct);
  const missed = attempts.filter((attempt) => !attempt.correct);
  const total = attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0);

  return (
    <div className="grid gap-5">
      <div className="panel grid gap-2 text-center">
        <p className="text-sm text-muted">{title}</p>
        <p className="nums font-display text-5xl font-medium tracking-tight">
          {correct.length}
          <span className="text-muted"> / {attempts.length}</span>
        </p>
        <p className="text-sm text-muted">
          {formatDuration(total)} in total{saved ? " · Saved" : " · Sample, not saved"}
        </p>
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-medium">Missed</h2>
        {missed.length === 0 ? (
          <p className="panel text-ink">Every word was right.</p>
        ) : (
          missed.map((attempt) => (
            <article className="panel grid gap-2" key={attempt.position}>
              <p className="font-display text-2xl font-medium">{attempt.prompt}</p>
              <p className="text-sm text-muted">
                You wrote <span className="text-bad">{attempt.answer}</span>
                <span className="nums"> · {formatDuration(attempt.durationMs)}</span>
              </p>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => speak(attempt.prompt, prefs, voices)}
              >
                <VolumeIcon className="size-5" />
                Listen
              </button>
            </article>
          ))
        )}
      </section>
      {correct.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium text-muted">Spelled correctly</h2>
          <ul className="grid gap-2">
            {correct.map((attempt) => (
              <li className="flex items-baseline justify-between gap-3 text-sm" key={attempt.position}>
                <span>{attempt.prompt}</span>
                <span className="nums text-muted">{formatDuration(attempt.durationMs)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
