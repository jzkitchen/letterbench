import { describe, expect, it } from "vitest";
import { handleRequest, PASSWORD_HEADER, type Env, type KvStore } from "./index";

class MemoryKv implements KvStore {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

const password = "test-family-password";
const url = "https://letterbench-api.example.workers.dev/store";

function env(): Env {
  return { STORE: new MemoryKv(), FAMILY_PASSWORD: password };
}

const payload = {
  version: 1,
  app: "letterbench",
  exportedAt: "2026-11-25T09:29:00.000Z",
  settings: { gender: "female", accent: "us", rate: 0.85 },
  sets: [{ id: "set-1", title: "Week", createdAt: "2026-11-25T09:00:00.000Z", updatedAt: "2026-11-25T09:00:00.000Z", items: [] }],
  sessions: [],
  results: [],
};

describe("letterbench worker", () => {
  it("serves a public empty store and allows the Pages origin", async () => {
    const response = await handleRequest(
      new Request(url, { headers: { origin: "https://jzkitchen.github.io" } }),
      env(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://jzkitchen.github.io");
    const body = (await response.json()) as { sets: unknown[]; exportedAt: string };
    expect(body.sets).toEqual([]);
    expect(body.exportedAt).toBe("");
  });

  it("rejects a write without the family password and accepts one with it", async () => {
    const store = env();
    const missing = await handleRequest(
      new Request(url, { method: "PUT", body: JSON.stringify(payload), headers: { "content-type": "application/json" } }),
      store,
    );
    expect(missing.status).toBe(401);

    const wrong = await handleRequest(
      new Request(url, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", [PASSWORD_HEADER]: "nope" },
      }),
      store,
    );
    expect(wrong.status).toBe(401);

    const accepted = await handleRequest(
      new Request(url, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", [PASSWORD_HEADER]: password, origin: "https://jzkitchen.github.io" },
      }),
      store,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("access-control-allow-origin")).toBe("https://jzkitchen.github.io");

    const read = await handleRequest(new Request(url), store);
    const body = (await read.json()) as { sets: { title: string }[] };
    expect(body.sets[0]?.title).toBe("Week");
  });

  it("answers the Pages preflight for the password header", async () => {
    const response = await handleRequest(
      new Request(url, {
        method: "OPTIONS",
        headers: { origin: "https://jzkitchen.github.io", "access-control-request-headers": PASSWORD_HEADER },
      }),
      env(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://jzkitchen.github.io");
    expect(response.headers.get("access-control-allow-headers")).toContain(PASSWORD_HEADER);
  });

  it("refuses writes when the secret is not configured", async () => {
    const response = await handleRequest(
      new Request(url, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", [PASSWORD_HEADER]: password },
      }),
      { STORE: new MemoryKv() },
    );
    expect(response.status).toBe(503);
  });
});
