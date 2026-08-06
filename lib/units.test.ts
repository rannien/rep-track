import { describe, expect, it } from "vitest";
import { formatVolume, parseStoredUnit, volumeFromKg, weightFromKg, weightToKg } from "./units";

describe("parseStoredUnit", () => {
  it("accepts exactly the two known units", () => {
    expect(parseStoredUnit("kg")).toBe("kg");
    expect(parseStoredUnit("lb")).toBe("lb");
  });

  it("rejects everything else", () => {
    for (const raw of [null, "", "KG", " lb", "lbs", "pounds", "0"]) {
      expect(parseStoredUnit(raw)).toBeNull();
    }
  });
});

describe("weight conversion", () => {
  it("passes kg through untouched in both directions", () => {
    expect(weightFromKg(82.75, "kg")).toBe(82.75);
    expect(weightToKg(82.75, "kg")).toBe(82.75);
  });

  it("round-trips a typed lb value exactly", () => {
    for (const typed of [100, 102.5, 45, 225, 2.5]) {
      expect(weightFromKg(weightToKg(typed, "lb"), "lb")).toBe(typed);
    }
  });

  it("converts stored kg to lb at 2-decimal display precision", () => {
    expect(weightFromKg(100, "lb")).toBe(220.46);
    expect(weightFromKg(0, "lb")).toBe(0);
  });
});

describe("volume", () => {
  it("keeps kg volumes untouched and converts lb at 1 decimal", () => {
    expect(volumeFromKg(577.5, "kg")).toBe(577.5);
    expect(volumeFromKg(1000, "lb")).toBe(2204.6);
  });

  it("formats with the unit and dashes out zero", () => {
    expect(formatVolume(1280, "kg")).toBe("1,280 kg");
    expect(formatVolume(1000, "lb")).toBe("2,204.6 lb");
    expect(formatVolume(0, "kg")).toBe("—");
    expect(formatVolume(0, "lb")).toBe("—");
  });
});
