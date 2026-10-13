import { describe, expect, it } from "vitest";
import { seasonOn } from "./season";

describe("seasonOn", () => {
  it("is halloween from the first to the last moment of October", () => {
    expect(seasonOn(new Date(2026, 9, 1, 0, 0, 0))).toBe("halloween");
    expect(seasonOn(new Date(2026, 9, 31, 23, 59, 59))).toBe("halloween");
  });

  it("is off-season either side of October", () => {
    expect(seasonOn(new Date(2026, 8, 30, 23, 59, 59))).toBeNull();
    expect(seasonOn(new Date(2026, 10, 1, 0, 0, 0))).toBeNull();
  });
});
