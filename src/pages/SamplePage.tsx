import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PracticeBoard } from "../components/PracticeBoard";
import { Shell } from "../components/Shell";
import { readPrefs, writePrefs } from "../lib/prefs";
import { schedulePush } from "../lib/sync-client";
import { grade, shuffle } from "../lib/puzzle";
import { SAMPLE_PROMPTS } from "../lib/sample";
import type { Attempt, Prefs } from "../lib/types";

export function SamplePage() {
  const [prompts] = useState(() => shuffle(SAMPLE_PROMPTS));
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const attempts = useRef<Attempt[]>([]);

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  return (
    <Shell>
      <div className="mb-4">
        <Link to="/" className="btn btn-ghost">
          Back
        </Link>
      </div>
      {prefs ? (
        <PracticeBoard
          title="Sample"
          items={prompts.map((prompt, position) => ({ position, prompt }))}
          startIndex={0}
          prefs={prefs}
          saved={false}
          onPrefs={(next) => {
            setPrefs(next);
            writePrefs(next);
            schedulePush();
          }}
          onAttempt={async (input) => {
            const prompt = prompts[input.position] ?? "";
            const graded = grade(prompt, input.letters);
            const attempt: Attempt = {
              position: input.position,
              prompt,
              answer: graded.answer,
              letters: input.letters,
              correct: graded.correct,
              durationMs: input.durationMs,
              submittedAt: new Date().toISOString(),
            };
            attempts.current = [...attempts.current.filter((entry) => entry.position !== attempt.position), attempt].sort(
              (left, right) => left.position - right.position,
            );
            const finished = attempts.current.length === prompts.length;
            return {
              ok: true,
              correct: graded.correct,
              answer: graded.answer,
              prompt,
              finished,
              attempts: finished ? attempts.current : null,
            };
          }}
        />
      ) : (
        <p className="text-sm text-muted">Loading the sample…</p>
      )}
    </Shell>
  );
}
