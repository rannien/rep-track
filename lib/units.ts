// Weight-unit preference. Storage is always kg (LoggedSet.weight, volume
// aggregates, backup files); the unit only changes what the user types and
// reads. Conversion happens at the display/input edge, never in the model.

export const UNIT_KEY = "rep-track-unit";

export type WeightUnit = "kg" | "lb";

export const DEFAULT_UNIT: WeightUnit = "kg";

export const KG_PER_LB = 0.45359237;

// localStorage is a trust boundary (see lib/sessions.ts): only the two exact
// strings are accepted; anything else yields null and the caller keeps kg.
export function parseStoredUnit(raw: string | null): WeightUnit | null {
  return raw === "kg" || raw === "lb" ? raw : null;
}

// kg (the storage unit) → display number. kg passes through untouched so
// directly-typed values render exactly as entered; lb trims to 2 decimals,
// which is what makes a typed lb value survive the round trip (100 lb →
// 45.359 kg → 100 lb).
export function weightFromKg(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : Number((kg / KG_PER_LB).toFixed(2));
}

// Display number (what the user typed) → kg for storage, rounded to 3
// decimals — the counterpart of weightFromKg's round-trip guarantee.
export function weightToKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : Number((value * KG_PER_LB).toFixed(3));
}

// Text label for a kg weight in the display unit ("82.5 kg", "220.46 lb").
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${weightFromKg(kg, unit).toLocaleString()} ${unit}`;
}

// kg volume (Σ weight × reps) → display volume, 1 decimal. Charts convert
// their point values with this before plotting so axes and tooltips agree.
export function volumeFromKg(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : Number((kg / KG_PER_LB).toFixed(1));
}

// Text label for a kg volume; zero renders as a dash (the app-wide
// convention for bodyweight-only work).
export function formatVolume(kg: number, unit: WeightUnit): string {
  return kg > 0 ? `${volumeFromKg(kg, unit).toLocaleString()} ${unit}` : "—";
}
