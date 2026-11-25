export const KV_KEY = "store";
const MAX_BYTES = 2_000_000;
const PAGES_ORIGIN = "https://jzkitchen.github.io";

export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  STORE: KvStore;
}

const EMPTY_STORE = {
  version: 1,
  app: "letterbench",
  exportedAt: "",
  settings: { gender: "female", accent: "us", rate: 0.85 },
  sets: [],
  sessions: [],
  results: [],
};

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === PAGES_ORIGIN) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  headers.set("vary", "Origin");
  const allow = allowedOrigin(origin);
  if (allow) {
    headers.set("access-control-allow-origin", allow);
    headers.set("access-control-allow-methods", "GET, PUT, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    headers.set("access-control-max-age", "86400");
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function isStorePayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.app !== "letterbench") return false;
  if ("sets" in record && !Array.isArray(record.sets)) return false;
  if ("sessions" in record && !Array.isArray(record.sessions)) return false;
  if ("results" in record && !Array.isArray(record.results)) return false;
  return true;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (url.pathname !== "/" && url.pathname !== "/store") {
    return json({ error: "Not found." }, 404, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method === "GET") {
    const stored = await env.STORE.get(KV_KEY);
    if (!stored) return json(EMPTY_STORE, 200, origin);
    try {
      return json(JSON.parse(stored) as unknown, 200, origin);
    } catch {
      return json(EMPTY_STORE, 200, origin);
    }
  }
  if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405, origin);

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: "That backup is too large." }, 413, origin);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return json({ error: "This file is not valid JSON." }, 400, origin);
  }
  if (!isStorePayload(parsed)) return json({ error: "This file is not a Letterbench backup." }, 400, origin);
  await env.STORE.put(KV_KEY, JSON.stringify(parsed));
  return json({ ok: true }, 200, origin);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
