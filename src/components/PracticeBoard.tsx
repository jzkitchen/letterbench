import { useEffect, useMemo, useRef, useState } from "react";
import { UndoIcon, VolumeIcon } from "./Icons";
import { ResultSheet } from "./ResultSheet";
import { VoiceControls } from "./VoiceControls";
import { formatDuration } from "../lib/format";
import { buildPuzzle, letterCount, type Slot } from "../lib/puzzle";
import { cancelSpeech, chooseVoice, speak, voiceNote } from "../lib/speech";
import { useVoices } from "../lib/useVoices";
import type { Attempt, AttemptResponse, Prefs } from "../lib/types";

type Item = { position: number; prompt: string };
type Phase = "answering" | "feedback";

export function PracticeBoard({
  title,
  items,
  startIndex,
  prefs,
  onPrefs,
  onAttempt,
  saved,
}: {
  title: string;
  items: Item[];
  startIndex: number;
  prefs: Prefs;
  onPrefs: (prefs: Prefs) => void;
  onAttempt: (input: { position: number; letters: string; durationMs: number }) => Promise<AttemptResponse>;
  saved: boolean;
}) {
  const [index, setIndex] = useState(startIndex);
  const [results, setResults] = useState<Attempt[] | null>(null);
  const item = items[index];

  if (results) return <ResultSheet title={title} attempts={results} saved={saved} prefs={prefs} />;
  if (!item) return null;

  return (
    <ItemRound
      key={item.position}
      title={title}
      item={item}
      index={index}
      total={items.length}
      prefs={prefs}
      onPrefs={onPrefs}
      onAttempt={onAttempt}
      onAdvance={(attempts) => {
        if (attempts) setResults(attempts);
        else setIndex((current) => current + 1);
      }}
    />
  );
}

function ItemRound({
  title,
  item,
  index,
  total,
  prefs,
  onPrefs,
  onAttempt,
  onAdvance,
}: {
  title: string;
  item: Item;
  index: number;
  total: number;
  prefs: Prefs;
  onPrefs: (prefs: Prefs) => void;
  onAttempt: (input: { position: number; letters: string; durationMs: number }) => Promise<AttemptResponse>;
  onAdvance: (attempts: Attempt[] | null) => void;
}) {
  const puzzle = useMemo(() => buildPuzzle(item.prompt), [item.prompt]);
  const needed = letterCount(puzzle.slots);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("answering");
  const [feedback, setFeedback] = useState<Extract<AttemptResponse, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const { voices, ready } = useVoices();
  const voicesRef = useRef(voices);
  voicesRef.current = voices;

  useEffect(() => {
    if (phase !== "answering") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!ready || phase !== "answering") return;
    const timer = window.setTimeout(() => speak(item.prompt, prefsRef.current, voicesRef.current), 80);
    return () => {
      window.clearTimeout(timer);
      cancelSpeech();
    };
  }, [ready, voices.length, phase, item.prompt]);

  const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile.char]));
  const letters = selected.map((id) => byId.get(id) ?? "");
  const choice = chooseVoice(voices, prefs);

  function toggleTile(id: string) {
    if (phase !== "answering") return;
    setSelected((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= needed) return current;
      return [...current, id];
    });
  }

  async function submit() {
    if (selected.length !== needed || saving || phase !== "answering") return;
    const durationMs = Date.now() - started.current;
    setSaving(true);
    setError(null);
    try {
      const result = await onAttempt({ position: item.position, letters: letters.join(""), durationMs });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setFeedback(result);
      setPhase("feedback");
      setSaving(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save this answer.");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <h1 className="nums font-display text-3xl font-medium tracking-tight">
            {index + 1} <span className="text-muted">of {total}</span>
          </h1>
        </div>
        <p className="nums text-sm text-muted" aria-label="Time on this item">
          {phase === "feedback" ? "Submitted" : formatDuration(Math.max(0, now - started.current))}
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${(index / total) * 100}%` }} />
      </div>
      <VoiceControls prefs={prefs} onChange={onPrefs} note={ready ? voiceNote(choice, voices.length > 0) : null} />
      <button type="button" className="btn btn-primary w-full" onClick={() => speak(item.prompt, prefs, voices)}>
        <VolumeIcon className="size-5" />
        Listen
      </button>
      <div className="panel grid gap-5">
        <Blanks slots={puzzle.slots} letters={letters} phase={phase} />
        <div className="tile-grid" aria-label="Letter tiles">
          {puzzle.tiles.map((tile) => {
            const pressed = selected.includes(tile.id);
            return (
              <button
                key={tile.id}
                type="button"
                className="tile"
                aria-pressed={pressed}
                disabled={phase !== "answering"}
                onClick={() => toggleTile(tile.id)}
              >
                {tile.char}
              </button>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted">Tiles stay put when you tap them.</p>
        {phase === "answering" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelected((current) => current.slice(0, -1))}
              disabled={selected.length === 0}
            >
              <UndoIcon className="size-4" />
              Undo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={selected.length !== needed || saving}
            >
              {saving ? "Saving…" : "Submit"}
            </button>
          </div>
        ) : feedback ? (
          <Feedback
            feedback={feedback}
            last={index + 1 === total}
            onNext={() => onAdvance(feedback.finished ? feedback.attempts : null)}
          />
        ) : null}
        {error ? (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        ) : null}
        {phase === "answering" && selected.length !== needed ? (
          <p className="text-center text-sm text-muted">Fill every blank, then submit.</p>
        ) : null}
      </div>
      <div className="sr-only" aria-live="polite">
        {feedback ? (feedback.correct ? "Correct" : "Not quite") : ""}
      </div>
    </div>
  );
}

function Blanks({ slots, letters, phase }: { slots: Slot[]; letters: string[]; phase: Phase }) {
  const words: Slot[][] = [];
  let current: Slot[] = [];
  for (const slot of slots) {
    if (slot.kind === "gap") {
      if (current.length) words.push(current);
      current = [];
    } else {
      current.push(slot);
    }
  }
  if (current.length) words.push(current);

  let letterIndex = 0;
  return (
    <div className="blanks" aria-label="Your spelling">
      {words.map((word, wordIndex) => (
        <span className="word" key={wordIndex}>
          {word.map((slot, slotIndex) => {
            if (slot.kind === "fixed") {
              return (
                <span className="fixed-char" key={slotIndex}>
                  {slot.char}
                </span>
              );
            }
            if (slot.kind !== "letter") return null;
            const typed = letters[letterIndex] ?? "";
            const mark = phase === "feedback" && typed ? (typed === slot.expected ? "is-good" : "is-bad") : "";
            letterIndex += 1;
            return (
              <span className={`blank ${mark}`} key={slotIndex}>
                {typed}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

function Feedback({
  feedback,
  last,
  onNext,
}: {
  feedback: Extract<AttemptResponse, { ok: true }>;
  last: boolean;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-3" role="status">
      <p className={`font-display text-2xl font-medium ${feedback.correct ? "text-good" : "text-bad"}`}>
        {feedback.correct ? "Correct" : "Not quite"}
      </p>
      {feedback.correct ? (
        <p className="font-display text-xl">{feedback.prompt}</p>
      ) : (
        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted">You wrote </span>
            {feedback.answer}
          </p>
          <p>
            <span className="text-muted">Right spelling </span>
            {feedback.prompt}
          </p>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={onNext}
        disabled={last && feedback.finished && !feedback.attempts}
      >
        {last ? "See results" : "Next"}
      </button>
    </div>
  );
}
