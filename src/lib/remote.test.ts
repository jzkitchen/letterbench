import { describe, expect, it } from "vitest";
import { PASSWORD_HEADER } from "./api-config";
import { buildBackup } from "./backup";
import { DEFAULT_PREFS } from "./prefs";
import { putRemote } from "./remote";

describe("remote writes", () => {
  it("sends the family password header and does not put the password in the body", async () => {
    const backup = buildBackup([], [], DEFAULT_PREFS, new Date("2026-11-25T09:00:00.000Z"));
    let header: string | null = null;
    let body = "";
    const status = await putRemote("https://letterbench-api.example.workers.dev/store", backup, "entered-on-device", async (_url, init) => {
      header = new Headers(init?.headers).get(PASSWORD_HEADER);
      body = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    });
    expect(status).toBe(200);
    expect(PASSWORD_HEADER).toBe("X-Family-Password");
    expect(header).toBe("entered-on-device");
    expect(body).not.toContain("entered-on-device");
    expect(JSON.parse(body)).toMatchObject({ version: 1, app: "letterbench" });
  });
});
