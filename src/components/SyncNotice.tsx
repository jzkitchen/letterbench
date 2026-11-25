import { useEffect, useState } from "react";
import { NOTICE_KEY } from "../lib/sync-client";

export function SyncNotice() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setText(sessionStorage.getItem(NOTICE_KEY));
    read();
    window.addEventListener("letterbench-sync", read);
    return () => window.removeEventListener("letterbench-sync", read);
  }, []);

  if (!text) return null;
  return (
    <p className="mb-4 text-sm text-muted" role="status">
      {text}
    </p>
  );
}
