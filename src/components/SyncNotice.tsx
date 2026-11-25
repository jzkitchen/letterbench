import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NOTICE_KEY, pushLocal, readFamilyPassword, writeFamilyPassword } from "../lib/sync-client";

export function SyncNotice() {
  const location = useLocation();
  const [text, setText] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => setText(sessionStorage.getItem(NOTICE_KEY));
    read();
    window.addEventListener("letterbench-sync", read);
    return () => window.removeEventListener("letterbench-sync", read);
  }, [location.pathname]);

  if (location.pathname === "/" || !text) return null;
  const needsPassword = text.includes("family password") && !readFamilyPassword();

  return (
    <div className="mb-4 grid gap-3">
      <p className="text-sm text-muted" role="status">
        {text}
      </p>
      {needsPassword ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = password.trim();
            if (!next) return;
            setBusy(true);
            writeFamilyPassword(next);
            void pushLocal(next).finally(() => setBusy(false));
          }}
        >
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
          <button className="btn btn-primary" type="submit" disabled={busy || password.trim() === ""}>
            {busy ? "Copying…" : "Remember and copy online"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
