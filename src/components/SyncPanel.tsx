import { useState, type FormEvent } from "react";
import {
  LOCAL_ONLY_NOTICE,
  clearFamilyPassword,
  pushLocal,
  readFamilyPassword,
  refreshFromOnline,
  writeFamilyPassword,
  type SyncPhase,
} from "../lib/sync-client";

const COPY: Record<SyncPhase, string> = {
  unconfigured: "Online sync is not configured yet. Everything stays on this device.",
  offline: "Couldn't reach the online copy. Your sets stay on this device.",
  idle: "This device matches the online copy.",
  hydrated: "Loaded the online copy onto this device.",
  uploaded: "Copied this device to the online store.",
  "local-only": LOCAL_ONLY_NOTICE,
  conflict: "This device and the online copy both have changes. Refresh or upload to choose one. Nothing was overwritten.",
  rejected: "That family password was not accepted. The change is still on this device.",
  unavailable: "The online copy is not ready for writes yet. Saved on this device.",
};

export function SyncPanel({ phase, onChanged }: { phase: SyncPhase; onChanged: () => void }) {
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(() => readFamilyPassword() !== "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = phase !== "unconfigured";

  function remember(event: FormEvent) {
    event.preventDefault();
    const next = password.trim();
    if (!next) return;
    writeFamilyPassword(next);
    setSaved(true);
    setPassword("");
    setError(null);
    setMessage("The family password is saved on this device. Upload to copy your sets online.");
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-medium text-muted">Online copy</h2>
      <div className="panel grid gap-3">
        <p className="text-sm text-muted">{message ?? COPY[phase]}</p>
        {configured ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void refreshFromOnline().then((result) => {
                    setBusy(false);
                    setMessage(result === "idle" ? "The online copy is empty, so this device was left as it is." : COPY[result]);
                    if (result === "hydrated") onChanged();
                  });
                }}
              >
                Refresh from online
              </button>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy}
                onClick={() => {
                  const next = password.trim() || readFamilyPassword();
                  if (!next) {
                    setError("Enter the family password to copy this device online.");
                    return;
                  }
                  if (password.trim()) writeFamilyPassword(password.trim());
                  setSaved(true);
                  setBusy(true);
                  setError(null);
                  void pushLocal(next).then((result) => {
                    setBusy(false);
                    setMessage(COPY[result]);
                    if (result === "uploaded") onChanged();
                    if (result === "rejected") setSaved(false);
                  });
                }}
              >
                {busy ? "Copying…" : "Upload this device"}
              </button>
            </div>
            <form className="grid gap-2" onSubmit={(event) => void remember(event)}>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-muted">Family password</span>
                <input
                  className="field"
                  type="password"
                  value={password}
                  autoComplete="off"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary" type="submit" disabled={busy || password.trim() === ""}>
                  Remember on this device
                </button>
                {saved ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      clearFamilyPassword();
                      setSaved(false);
                      setPassword("");
                    }}
                  >
                    Forget
                  </button>
                ) : null}
              </div>
              {saved ? <p className="text-sm text-muted">A family password is saved on this device.</p> : null}
            </form>
          </>
        ) : null}
        {error ? (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
