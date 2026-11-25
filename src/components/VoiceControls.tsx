import type { Accent, Gender, Prefs } from "../lib/types";
import { clampRate } from "../lib/prefs";

export function VoiceControls({
  prefs,
  onChange,
  note,
}: {
  prefs: Prefs;
  onChange: (prefs: Prefs) => void;
  note?: string | null;
}) {
  function setGender(gender: Gender) {
    onChange({ ...prefs, gender });
  }
  function setAccent(accent: Accent) {
    onChange({ ...prefs, accent });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-muted">Voice</legend>
          <div className="seg" role="group" aria-label="Voice">
            <button type="button" aria-pressed={prefs.gender === "female"} onClick={() => setGender("female")}>
              Female
            </button>
            <button type="button" aria-pressed={prefs.gender === "male"} onClick={() => setGender("male")}>
              Male
            </button>
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-muted">Accent</legend>
          <div className="seg" role="group" aria-label="Accent">
            <button type="button" aria-pressed={prefs.accent === "us"} onClick={() => setAccent("us")}>
              American
            </button>
            <button type="button" aria-pressed={prefs.accent === "uk"} onClick={() => setAccent("uk")}>
              British
            </button>
          </div>
        </fieldset>
      </div>
      <label className="grid gap-2 text-sm font-medium text-muted">
        <span className="flex items-center justify-between">
          Speed
          <span className="nums text-ink">{prefs.rate.toFixed(2)}×</span>
        </span>
        <input
          className="h-11 w-full"
          type="range"
          min={0.6}
          max={1.3}
          step={0.05}
          value={prefs.rate}
          aria-valuetext={`${prefs.rate.toFixed(2)} times`}
          onChange={(event) => onChange({ ...prefs, rate: clampRate(Number(event.target.value)) })}
        />
        <span className="flex justify-between text-sm font-normal">
          <span>Slow</span>
          <span>Fast</span>
        </span>
      </label>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}
