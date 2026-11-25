import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DictationSet, Session } from "./types";

export const DB_NAME = "letterbench";
export const STORE_KEY = "letterbench-store";

interface LetterbenchDB extends DBSchema {
  sets: { key: string; value: DictationSet };
  sessions: { key: string; value: Session };
}

type Snapshot = { sets: DictationSet[]; sessions: Session[] };

export interface Repo {
  loadSets(): Promise<DictationSet[]>;
  loadSessions(): Promise<Session[]>;
  saveSet(set: DictationSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  saveSession(session: Session): Promise<void>;
  updateSession(id: string, mutate: (session: Session) => Session): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  replaceAll(sets: DictationSet[], sessions: Session[]): Promise<void>;
}

class WriteQueue {
  private chain: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

class IdbRepo implements Repo {
  private readonly writes = new WriteQueue();

  constructor(private readonly db: IDBPDatabase<LetterbenchDB>) {}

  loadSets(): Promise<DictationSet[]> {
    return this.db.getAll("sets");
  }

  loadSessions(): Promise<Session[]> {
    return this.db.getAll("sessions");
  }

  saveSet(set: DictationSet): Promise<void> {
    return this.writes.enqueue(async () => {
      await this.db.put("sets", set);
    });
  }

  deleteSet(id: string): Promise<void> {
    return this.writes.enqueue(async () => {
      const tx = this.db.transaction(["sets", "sessions"], "readwrite");
      await tx.objectStore("sets").delete(id);
      const sessions = await tx.objectStore("sessions").getAll();
      await Promise.all(
        sessions
          .filter((session) => session.setId === id && session.finishedAt == null)
          .map((session) => tx.objectStore("sessions").delete(session.id)),
      );
      await tx.done;
    });
  }

  saveSession(session: Session): Promise<void> {
    return this.writes.enqueue(async () => {
      await this.db.put("sessions", session);
    });
  }

  updateSession(id: string, mutate: (session: Session) => Session): Promise<Session | null> {
    return this.writes.enqueue(async () => {
      const current = await this.db.get("sessions", id);
      if (!current) return null;
      const next = mutate(current);
      await this.db.put("sessions", next);
      return next;
    });
  }

  deleteSession(id: string): Promise<void> {
    return this.writes.enqueue(() => this.db.delete("sessions", id));
  }

  replaceAll(sets: DictationSet[], sessions: Session[]): Promise<void> {
    return this.writes.enqueue(async () => {
      const tx = this.db.transaction(["sets", "sessions"], "readwrite");
      await tx.objectStore("sets").clear();
      await tx.objectStore("sessions").clear();
      for (const set of sets) await tx.objectStore("sets").put(set);
      for (const session of sessions) await tx.objectStore("sessions").put(session);
      await tx.done;
    });
  }
}

class LocalRepo implements Repo {
  private readonly writes = new WriteQueue();

  constructor(private readonly storage: Storage) {}

  private read(): Snapshot {
    try {
      const parsed = JSON.parse(this.storage.getItem(STORE_KEY) ?? "") as Partial<Snapshot>;
      return {
        sets: Array.isArray(parsed.sets) ? parsed.sets : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return { sets: [], sessions: [] };
    }
  }

  private write(snapshot: Snapshot): void {
    this.storage.setItem(STORE_KEY, JSON.stringify(snapshot));
  }

  async loadSets(): Promise<DictationSet[]> {
    return this.read().sets;
  }

  async loadSessions(): Promise<Session[]> {
    return this.read().sessions;
  }

  saveSet(set: DictationSet): Promise<void> {
    return this.writes.enqueue(async () => {
      const snapshot = this.read();
      this.write({ ...snapshot, sets: [...snapshot.sets.filter((item) => item.id !== set.id), set] });
    });
  }

  deleteSet(id: string): Promise<void> {
    return this.writes.enqueue(async () => {
      const snapshot = this.read();
      this.write({
        sets: snapshot.sets.filter((set) => set.id !== id),
        sessions: snapshot.sessions.filter((session) => !(session.setId === id && session.finishedAt == null)),
      });
    });
  }

  saveSession(session: Session): Promise<void> {
    return this.writes.enqueue(async () => {
      const snapshot = this.read();
      this.write({
        ...snapshot,
        sessions: [...snapshot.sessions.filter((item) => item.id !== session.id), session],
      });
    });
  }

  updateSession(id: string, mutate: (session: Session) => Session): Promise<Session | null> {
    return this.writes.enqueue(async () => {
      const snapshot = this.read();
      const current = snapshot.sessions.find((session) => session.id === id);
      if (!current) return null;
      const next = mutate(current);
      this.write({
        ...snapshot,
        sessions: snapshot.sessions.map((session) => (session.id === id ? next : session)),
      });
      return next;
    });
  }

  deleteSession(id: string): Promise<void> {
    return this.writes.enqueue(async () => {
      const snapshot = this.read();
      this.write({ ...snapshot, sessions: snapshot.sessions.filter((session) => session.id !== id) });
    });
  }

  replaceAll(sets: DictationSet[], sessions: Session[]): Promise<void> {
    return this.writes.enqueue(async () => {
      this.write({ sets, sessions });
    });
  }
}

let opening: Promise<Repo> | null = null;

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

async function createRepo(): Promise<Repo> {
  if (canUseIndexedDb()) {
    try {
      const db = await openDB<LetterbenchDB>(DB_NAME, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains("sets")) database.createObjectStore("sets", { keyPath: "id" });
          if (!database.objectStoreNames.contains("sessions")) {
            database.createObjectStore("sessions", { keyPath: "id" });
          }
        },
      });
      return new IdbRepo(db);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      const blocked = name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError";
      if (!blocked) throw error;
    }
  }
  if (typeof localStorage === "undefined") {
    throw new Error("This browser cannot store Letterbench data.");
  }
  return new LocalRepo(localStorage);
}

export function repo(): Promise<Repo> {
  if (!opening) {
    opening = createRepo().catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

export function resetRepoForTests(): void {
  opening = null;
}
