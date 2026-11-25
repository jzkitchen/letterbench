import { describe, expect, it } from "vitest";
import { buildBackup } from "./backup";
import { DEFAULT_PREFS } from "./prefs";
import { putRemote } from "./remote";

describe("remote writes", () => {
  it("uploads the store without a password header", async () => {
    const backup = buildBackup([], [], DEFAULT_PREFS, new Date("2026-11-25T09:00:00.000Z"));
    let header: string | null = null;
    let body = "";
    const status = await putRemote("https://letterbench-api.eyeshadow-lee.workers.dev/store", backup, async (_url, init) => {
      header = new Headers(init?.headers).get("x-family-password");
      body = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    });
    expect(status).toBe(200);
    expect(header).toBeNull();
    expect(JSON.parse(body)).toMatchObject({ version: 1, app: "letterbench" });
  });
});