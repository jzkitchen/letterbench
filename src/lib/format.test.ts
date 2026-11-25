import { describe, expect, it } from "vitest";
import { formatDuration, formatWhen } from "./format";

describe("format", () => {
  it("formats durations like the practice clock", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(12000)).toBe("12s");
    expect(formatDuration(60000)).toBe("1m 00s");
    expect(formatDuration(65000)).toBe("1m 05s");
  });

  it("formats finished dates in day-month-year form", () => {
    const local = new Date(2026, 10, 25, 9, 29);
    expect(formatWhen(local.toISOString())).toBe("25 Nov 2026, 09:29");
  });
});
