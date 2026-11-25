import { useState } from "react";
import { parseLines, parseTitle } from "../lib/puzzle";

const PLACEHOLDER = "apple\nbecause\nI like reading.";

export function SetEditor({
  initialTitle,
  initialBody,
  submitLabel,
  onSubmit,
}: {
  initialTitle: string;
  initialBody: string;
  submitLabel: string;
  onSubmit: (title: string, lines: string[]) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsedTitle = parseTitle(title);
        if (parsedTitle.error) {
          setError(parsedTitle.error);
          return;
        }
        const parsedLines = parseLines(body.split(/\r?\n/));
        if (parsedLines.error) {
          setError(parsedLines.error);
          return;
        }
        setSaving(true);
        setError(null);
        onSubmit(parsedTitle.title, parsedLines.items)
          .then((message) => {
            if (message) setError(message);
            setSaving(false);
          })
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "Couldn't save this set.");
            setSaving(false);
          });
      }}
    >
      <label className="grid gap-2">
        <span className="text-sm font-medium text-muted">Set name</span>
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
          maxLength={80}
          required
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-muted">Words and sentences</span>
        <textarea
          className="area"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={PLACEHOLDER}
          required
        />
      </label>
      <p className="text-sm text-muted">
        One word or sentence per line. Capitals are not tested. Spaces and punctuation are filled in for the child.
      </p>
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" type="submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
