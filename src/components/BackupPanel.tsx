import { useRef, useState } from "react";
import {
  backupFilename,
  buildBackup,
  parseBackupText,
  planSummary,
  type ImportPlan,
} from "../lib/backup";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import { readPrefs, writePrefs } from "../lib/prefs";

export function BackupPanel({ onRestored }: { onRestored: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setError(null);
    setStatus(null);
    try {
      const store = await repo();
      const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
      const backup = buildBackup(sets, sessions, readPrefs());
      const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename();
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Backup downloaded.");
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function chooseFile(file: File | undefined) {
    setError(null);
    setStatus(null);
    setPlan(null);
    if (!file) return;
    try {
      const text = await file.text();
      setPlan(parseBackupText(text));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function restore() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const store = await repo();
      if (plan.replaceSets || plan.replaceSessions) {
        const [sets, sessions] = await Promise.all([store.loadSets(), store.loadSessions()]);
        await store.replaceAll(plan.replaceSets ? plan.sets : sets, plan.replaceSessions ? plan.sessions : sessions);
      }
      if (plan.settings) writePrefs(plan.settings);
      setPlan(null);
      setStatus("Backup restored on this device.");
      onRestored();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-medium text-muted">Backup</h2>
      <div className="panel grid gap-3">
        <p className="text-sm text-muted">
          Download one JSON file of the voice settings, sets, in-progress sessions, and results stored on this device,
          or restore a file from this app.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn btn-secondary w-full" onClick={() => void download()}>
            Backup
          </button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => inputRef.current?.click()}>
            Restore
          </button>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Restore a Letterbench backup"
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
        {plan ? (
          <div className="grid gap-3">
            <p>Restore this backup? This replaces matching data on this device ({planSummary(plan)}).</p>
            {plan.warnings.length > 0 ? (
              <ul className="grid gap-1 text-sm text-muted">
                {plan.warnings.slice(0, 6).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setPlan(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void restore()} disabled={busy}>
                {busy ? "Restoring…" : "Replace"}
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="text-sm text-muted" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
