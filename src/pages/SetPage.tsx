import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { VolumeIcon } from "../components/Icons";
import { Loading, Shell } from "../components/Shell";
import { VoiceControls } from "../components/VoiceControls";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import { readPrefs, writePrefs } from "../lib/prefs";
import { createSession } from "../lib/sessions";
import { pushLocalIfPossible, schedulePush } from "../lib/sync-client";
import { cancelSpeech, chooseVoice, speak, voiceNote } from "../lib/speech";
import type { DictationSet, Prefs } from "../lib/types";
import { useVoices } from "../lib/useVoices";

export function SetPage() {
  const { setId = "" } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState<DictationSet | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const { voices, ready } = useVoices();

  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    let cancel = false;
    repo()
      .then((store) => store.loadSets())
      .then((sets) => {
        if (cancel) return;
        const found = sets.find((entry) => entry.id === setId) ?? null;
        if (!found) {
          setMissing(true);
          return;
        }
        setSet(found);
        setPrefs(readPrefs());
        setSelected(new Set(found.items.map((item) => item.id)));
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(messageOf(reason));
      });
    return () => {
      cancel = true;
    };
  }, [setId]);

  function updatePrefs(next: Prefs) {
    setPrefs(next);
    writePrefs(next);
    schedulePush();
  }

  const chosen = set && selected ? set.items.filter((item) => selected.has(item.id)) : [];

  async function dictate() {
    if (!set || !prefs || chosen.length === 0 || starting) return;
    setStarting(true);
    setError(null);
    try {
      const session = createSession(set, chosen.map((item) => item.id), prefs);
      const store = await repo();
      await store.saveSession(session);
      await pushLocalIfPossible();
      await navigate(`/practice/${session.id}`);
    } catch (reason) {
      setError(messageOf(reason));
      setStarting(false);
    }
  }

  async function remove() {
    try {
      const store = await repo();
      await store.deleteSet(setId);
      await pushLocalIfPossible();
      await navigate("/");
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <Shell>
      <div className="mb-4">
        <Link to="/" className="btn btn-ghost">
          Sets
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      {missing ? <p>That set isn't here.</p> : null}
      {!set || !prefs ? (
        missing || error ? null : (
          <Loading label="Loading this set…" />
        )
      ) : reviewing ? (
        <Review
          title={set.title}
          items={chosen}
          prefs={prefs}
          note={ready ? voiceNote(chooseVoice(voices, prefs), voices.length > 0) : null}
          onPrefs={updatePrefs}
          onHear={(text) => speak(text, prefs, voices)}
          onBack={() => {
            cancelSpeech();
            setReviewing(false);
          }}
        />
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-medium tracking-tight">{set.title}</h1>
            <Link to={`/sets/${set.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="nums text-sm text-muted">
              {chosen.length} of {set.items.length} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelected(new Set(set.items.map((item) => item.id)))}
              >
                Select all
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>
          <ul className="grid gap-2">
            {set.items.map((item) => {
              const on = selected.has(item.id);
              return (
                <li key={item.id} className={`check-row ${on ? "is-on" : ""}`}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      checked={on}
                      onChange={() => {
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                    />
                    <span className="break-words">{item.body}</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary shrink-0"
                    aria-label={`Hear ${item.body}`}
                    onClick={() => speak(item.body, prefs, voices)}
                  >
                    <VolumeIcon className="size-5" />
                    Hear
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="panel">
            <VoiceControls prefs={prefs} onChange={updatePrefs} />
          </div>
          {chosen.length === 0 ? <p className="text-sm text-muted">Choose at least one line.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={chosen.length === 0}
              onClick={() => setReviewing(true)}
            >
              {chosen.length === set.items.length ? "Review all" : `Review ${chosen.length}`}
            </button>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={chosen.length === 0 || starting}
              onClick={() => void dictate()}
            >
              {starting ? "Starting…" : chosen.length === set.items.length ? "Dictate all" : `Dictate ${chosen.length}`}
            </button>
          </div>
          {confirmDelete ? (
            <div className="panel grid gap-3">
              <p>Delete this set? Past scores stay in your results.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void remove()}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
              Delete set
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

function Review({
  title,
  items,
  prefs,
  note,
  onPrefs,
  onHear,
  onBack,
}: {
  title: string;
  items: { id: string; body: string }[];
  prefs: Prefs;
  note: string | null;
  onPrefs: (prefs: Prefs) => void;
  onHear: (text: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Review</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Choose lines
        </button>
      </div>
      <p className="text-sm text-muted">
        {items.length} {items.length === 1 ? "line" : "lines"}. Hear each one. This is not scored.
      </p>
      <div className="panel">
        <VoiceControls prefs={prefs} onChange={onPrefs} note={note} />
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li className="check-row review-row" key={item.id}>
            <span className="min-w-0 flex-1 break-words">{item.body}</span>
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              aria-label={`Hear ${item.body}`}
              onClick={() => onHear(item.body)}
            >
              <VolumeIcon className="size-5" />
              Hear
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
