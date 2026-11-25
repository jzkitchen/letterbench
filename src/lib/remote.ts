import { parseBackup, type BackupFile } from "./backup";
import { DEFAULT_PREFS } from "./prefs";

export async function fetchRemote(url: string, fetcher: typeof fetch = fetch): Promise<BackupFile | null> {
  try {
    const response = await fetcher(url, { method: "GET", cache: "no-store" });
    if (!response.ok) return null;
    return readRemoteBackup(await response.json());
  } catch {
    return null;
  }
}

export function readRemoteBackup(input: unknown): BackupFile | null {
  if (!input || typeof input !== "object") return null;
  try {
    const plan = parseBackup(input);
    const exportedAt = typeof (input as { exportedAt?: unknown }).exportedAt === "string" ? (input as { exportedAt: string }).exportedAt : "";
    return {
      version: 1,
      app: "letterbench",
      exportedAt,
      settings: plan.settings ?? DEFAULT_PREFS,
      sets: plan.replaceSets ? plan.sets : [],
      sessions: plan.replaceSessions ? plan.sessions : [],
      results: plan.sessions.filter((session) => session.finishedAt),
    };
  } catch {
    return null;
  }
}

export async function putRemote(url: string, backup: BackupFile, fetcher: typeof fetch = fetch): Promise<number> {
  const response = await fetcher(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(backup),
  });
  return response.status;
}
