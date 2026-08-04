import { describe, expect, it } from "vitest";
import {
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  clampRestSeconds,
  formatClock,
  parseStoredRestSeconds,
} from "./rest-timer";

describe("clampRestSeconds", () => {
  it("keeps in-range values, rounded to whole seconds", () => {
    expect(clampRestSeconds(120)).toBe(120);
    expect(clampRestSeconds(127.4)).toBe(127);
    expect(clampRestSeconds(127.6)).toBe(128);
  });

  it("clamps to the supported range", () => {
    expect(clampRestSeconds(1)).toBe(MIN_REST_SECONDS);
    expect(clampRestSeconds(-30)).toBe(MIN_REST_SECONDS);
    expect(clampRestSeconds(10_000)).toBe(MAX_REST_SECONDS);
  });
});

describe("parseStoredRestSeconds", () => {
  it("accepts a whole number of seconds within bounds", () => {
    expect(parseStoredRestSeconds("120")).toBe(120);
    expect(parseStoredRestSeconds(String(MIN_REST_SECONDS))).toBe(MIN_REST_SECONDS);
    expect(parseStoredRestSeconds(String(MAX_REST_SECONDS))).toBe(MAX_REST_SECONDS);
  });

  it("rejects a missing value", () => {
    expect(parseStoredRestSeconds(null)).toBeNull();
    expect(parseStoredRestSeconds("")).toBeNull();
  });

  it("rejects hand-edited garbage instead of guessing", () => {
    expect(parseStoredRestSeconds("abc")).toBeNull();
    expect(parseStoredRestSeconds("90.5")).toBeNull();
    expect(parseStoredRestSeconds("120abc")).toBeNull();
    expect(parseStoredRestSeconds(" 90")).toBeNull();
    expect(parseStoredRestSeconds("-90")).toBeNull();
  });

  it("rejects out-of-bounds values so the default applies", () => {
    expect(parseStoredRestSeconds(String(MIN_REST_SECONDS - 1))).toBeNull();
    expect(parseStoredRestSeconds(String(MAX_REST_SECONDS + 1))).toBeNull();
  });

  it("keeps the built-in default inside its own bounds", () => {
    expect(clampRestSeconds(DEFAULT_REST_SECONDS)).toBe(DEFAULT_REST_SECONDS);
  });
});

describe("formatClock", () => {
  it("formats m:ss with zero-padded seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(600)).toBe("10:00");
  });
});
