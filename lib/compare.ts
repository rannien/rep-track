// Friend comparison: a second, read-only history imported from a friend's
// backup file and compared against the user's own — records side by side and
// volume totals. File-based on purpose: there is no backend, so nothing leaves
// the device and the friend's sets never mix into the user's own history.

import {
  type PersonalRecord,
  type Session,
  type TotalStats,
  formatSet,
  parseSessionsArray,
  personalRecords,
  setLoad,
  totalStats,
} from "./sessions";
import type { WeightUnit } from "./units";
import type { WorkoutDay } from "./workouts";

export const COMPARE_KEY = "rep-track-compare-v1";
export const MAX_PROFILE_NAME_LENGTH = 40;
const DEFAULT_PROFILE_NAME = "Friend";

export type ComparisonProfile = {
  name: string; // how the friend is labeled in the UI
  importedAt: string; // ISO timestamp of the import — their data is a snapshot as of then
  sessions: Session[];
};

// Trim, cap, and fall back to a default so the UI never shows a blank label.
export function normalizeProfileName(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_PROFILE_NAME_LENGTH);
  return trimmed === "" ? DEFAULT_PROFILE_NAME : trimmed;
}

// localStorage is a trust boundary (see lib/sessions.ts). The sessions run
// through the shared validator (invalid ones drop individually); a corrupt
// array or envelope yields null — the profile is re-importable from the
// friend's file, so there is nothing worth salvaging.
export function parseComparisonProfile(raw: string | null): ComparisonProfile | null {
  if (raw === null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { name, importedAt, sessions } = parsed as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof importedAt !== "string" || Number.isNaN(Date.parse(importedAt))) return null;
  const result = parseSessionsArray(sessions);
  if (result.kind === "corrupt") return null;
  return { name: normalizeProfileName(name), importedAt, sessions: result.sessions };
}

export function loadComparisonProfile(): ComparisonProfile | null {
  if (typeof window === "undefined") return null;
  try {
    return parseComparisonProfile(window.localStorage.getItem(COMPARE_KEY));
  } catch {
    // Storage inaccessible (blocked/private mode): no profile to compare with.
    return null;
  }
}

export type SaveProfileResult = { ok: true } | { ok: false; error: unknown };

export function saveComparisonProfile(profile: ComparisonProfile): SaveProfileResult {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(profile));
    return { ok: true };
  } catch (error) {
    // Quota exceeded (a whole second history is the largest thing we store),
    // or storage unavailable.
    return { ok: false, error };
  }
}

export function clearComparisonProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPARE_KEY);
  } catch {
    // Nothing to do — an unreadable store has no profile to clear.
  }
}

export type Leader = "you" | "friend" | "tie";

export type RecordComparison = {
  exercise: string;
  mine: PersonalRecord | null;
  theirs: PersonalRecord | null;
  leader: Leader;
};

// Heavier total load wins, so a doubled set counts both implements — the same
// yardstick /records ranks by. A side without a record loses by default.
function leaderOf(mine: PersonalRecord | null, theirs: PersonalRecord | null): Leader {
  if (!mine) return "friend";
  if (!theirs) return "you";
  const a = setLoad(mine.set);
  const b = setLoad(theirs.set);
  if (a === b) return "tie";
  return a > b ? "you" : "friend";
}

// Both sides' personal records joined by exercise name: every exercise either
// side has a record for, plan order first (via `days`), then off-plan names
// alphabetically. The plan is a parameter so tests stay synthetic.
export function compareRecords(
  mine: Session[],
  theirs: Session[],
  days: WorkoutDay[],
): RecordComparison[] {
  const mineBy = new Map(personalRecords(mine).map((record) => [record.exercise, record]));
  const theirsBy = new Map(personalRecords(theirs).map((record) => [record.exercise, record]));
  const remaining = new Set([...mineBy.keys(), ...theirsBy.keys()]);
  const ordered: string[] = [];
  for (const day of days) {
    for (const exercise of day.exercises) {
      if (remaining.delete(exercise.name)) ordered.push(exercise.name);
    }
  }
  ordered.push(...[...remaining].toSorted((a, b) => a.localeCompare(b)));
  return ordered.map((exercise) => {
    const m = mineBy.get(exercise) ?? null;
    const t = theirsBy.get(exercise) ?? null;
    return { exercise, mine: m, theirs: t, leader: leaderOf(m, t) };
  });
}

export type SideTotals = TotalStats & {
  avgVolumePerSession: number; // whole kg; the fairer number when histories differ in length
};

export function sideTotals(sessions: Session[]): SideTotals {
  const totals = totalStats(sessions);
  return {
    ...totals,
    avgVolumePerSession: totals.sessions > 0 ? Math.round(totals.volume / totals.sessions) : 0,
  };
}

export function compareTotals(
  mine: Session[],
  theirs: Session[],
): { you: SideTotals; friend: SideTotals } {
  return { you: sideTotals(mine), friend: sideTotals(theirs) };
}

// The human-readable teaser for the share sheet / clipboard. The real exchange
// format for comparing is the backup file — this is what you text a friend.
export function formatRecordsShareText(records: PersonalRecord[], unit: WeightUnit): string {
  return [
    "My Rep Track records",
    ...records.map((r) => `• ${r.exercise} — ${formatSet(r.set, unit)}`),
  ].join("\n");
}
