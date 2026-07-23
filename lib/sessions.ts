// Rep Track session model: a training day groups the sets logged for each
// exercise. Persisted to localStorage; see components/session-provider.tsx for
// the React layer that reads/writes this.

export type LoggedSet = {
  id: string;
  reps: number;
  weight: number; // kg; 0 = bodyweight / not recorded
};

export type ExerciseEntry = {
  exercise: string; // matches Exercise.name in lib/workouts.ts
  sets: LoggedSet[];
};

export type Session = {
  id: string;
  dayId: string;
  dayLabel: string;
  dateKey: string; // YYYY-MM-DD in local time — one session per (day, calendar date)
  startedAt: string; // ISO timestamp of the first logged set
  entries: ExerciseEntry[];
};

export const SESSIONS_KEY = "rep-track-sessions-v1";
// Raw payloads that fail validation are copied here before being dropped, so
// corrupt data is preserved for manual recovery instead of being overwritten
// by the next save.
export const SESSIONS_BACKUP_KEY = "rep-track-sessions-v1-corrupt";

// localStorage is a trust boundary: the stored JSON may come from an older
// app version or hand editing. Each parser rebuilds the value it returns —
// adding a field to a type breaks compilation here rather than letting
// unvalidated data through — and unknown keys are stripped in the process.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function parseLoggedSet(value: unknown): LoggedSet | null {
  if (!isRecord(value)) return null;
  const { id, reps, weight } = value;
  if (!isNonEmptyString(id)) return null;
  if (typeof reps !== "number" || !Number.isInteger(reps) || reps <= 0) return null;
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) return null;
  return { id, reps, weight };
}

function parseExerciseEntry(value: unknown): ExerciseEntry | null {
  if (!isRecord(value)) return null;
  const { exercise, sets } = value;
  if (!isNonEmptyString(exercise) || !Array.isArray(sets)) return null;
  const parsedSets: LoggedSet[] = [];
  for (const set of sets) {
    const parsed = parseLoggedSet(set);
    if (!parsed) return null;
    parsedSets.push(parsed);
  }
  return { exercise, sets: parsedSets };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseSession(value: unknown): Session | null {
  if (!isRecord(value)) return null;
  const { id, dayId, dayLabel, dateKey, startedAt, entries } = value;
  if (!isNonEmptyString(id) || !isNonEmptyString(dayId)) return null;
  if (typeof dayLabel !== "string") return null;
  if (typeof dateKey !== "string" || !DATE_KEY_PATTERN.test(dateKey)) return null;
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) return null;
  if (!Array.isArray(entries)) return null;
  const parsedEntries: ExerciseEntry[] = [];
  for (const entry of entries) {
    const parsed = parseExerciseEntry(entry);
    // One bad entry invalidates its whole session — never keep a session
    // whose contents were silently altered.
    if (!parsed) return null;
    parsedEntries.push(parsed);
  }
  return { id, dayId, dayLabel, dateKey, startedAt, entries: parsedEntries };
}

export type ParsedSessions =
  | { kind: "ok"; sessions: Session[] }
  | { kind: "partial"; sessions: Session[]; dropped: number }
  | { kind: "corrupt"; sessions: Session[] }; // sessions is always [] here

// Validate a raw sessions payload. Invalid sessions are dropped individually,
// so one bad element doesn't cost the whole history.
export function parseSessionsBlob(raw: string | null): ParsedSessions {
  if (raw === null || raw === "") return { kind: "ok", sessions: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupt", sessions: [] };
  }
  if (!Array.isArray(parsed)) return { kind: "corrupt", sessions: [] };
  const sessions: Session[] = [];
  for (const candidate of parsed) {
    const session = parseSession(candidate);
    if (session) sessions.push(session);
  }
  const dropped = parsed.length - sessions.length;
  return dropped > 0 ? { kind: "partial", sessions, dropped } : { kind: "ok", sessions };
}

export type LoadSessionsResult = ParsedSessions & { backedUp: boolean };

export function loadSessions(): LoadSessionsResult {
  if (typeof window === "undefined") return { kind: "ok", sessions: [], backedUp: false };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSIONS_KEY);
  } catch {
    // Storage inaccessible (blocked/private mode): nothing to load or back
    // up; the first failing save surfaces the problem to the user.
    return { kind: "ok", sessions: [], backedUp: false };
  }
  const result = parseSessionsBlob(raw);
  if (result.kind === "ok" || raw === null) return { ...result, backedUp: false };
  // Preserve the rejected payload before returning, so no later save of the
  // salvaged (or empty) state can destroy it.
  let backedUp = false;
  try {
    window.localStorage.setItem(SESSIONS_BACKUP_KEY, raw);
    backedUp = true;
  } catch {
    // Best effort — a quota error here must not block loading what survived.
  }
  return { ...result, backedUp };
}

export type SaveSessionsResult = { ok: true } | { ok: false; error: unknown };

export function saveSessions(sessions: Session[]): SaveSessionsResult {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return { ok: true };
  } catch (error) {
    // Quota exceeded, or storage unavailable (e.g. Safari private mode).
    return { ok: false, error };
  }
}

// Loose sanity bounds for the logging form — cap garbage, not training.
export const MAX_REPS = 500;
export const MAX_WEIGHT_KG = 1000;

// Reps as typed into the logging form; null when not a loggable value.
export function parseRepsInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const reps = Number.parseInt(trimmed, 10);
  return reps > 0 && reps <= MAX_REPS ? reps : null;
}

// Weight as typed into the logging form; empty means bodyweight (0 kg) and
// comma decimals are accepted. Null when not a loggable value.
export function parseWeightInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const weight = Number.parseFloat(trimmed.replace(",", "."));
  return weight <= MAX_WEIGHT_KG ? weight : null;
}

// Local calendar date as YYYY-MM-DD (en-CA renders ISO-style dates).
export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export type SessionStats = {
  sets: number;
  reps: number;
  volume: number; // kg moved across the session: Σ weight × reps
};

// Volume (kg moved) for a single exercise entry: Σ weight × reps.
export function entryVolume(entry: ExerciseEntry): number {
  return entry.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
}

function entryReps(entry: ExerciseEntry): number {
  return entry.sets.reduce((sum, set) => sum + set.reps, 0);
}

// Accumulate one entry's sets/reps/volume into a mutable aggregate.
function addEntryStats(target: SessionStats, entry: ExerciseEntry): void {
  target.sets += entry.sets.length;
  target.reps += entryReps(entry);
  target.volume += entryVolume(entry);
}

// Aggregate sets, reps, and volume for a session.
export function sessionStats(session: Session): SessionStats {
  const stats: SessionStats = { sets: 0, reps: 0, volume: 0 };
  for (const entry of session.entries) {
    addEntryStats(stats, entry);
  }
  return stats;
}

// Metric the stats charts plot; volume is kg moved, reps a plain count —
// never both on one axis.
export type StatsMetric = "volume" | "reps";

export type TotalStats = {
  sessions: number;
  sets: number;
  reps: number;
  volume: number;
};

// Lifetime totals across the whole history, for the stats page KPI row.
export function totalStats(sessions: Session[]): TotalStats {
  const totals: TotalStats = { sessions: sessions.length, sets: 0, reps: 0, volume: 0 };
  for (const session of sessions) {
    for (const entry of session.entries) {
      addEntryStats(totals, entry);
    }
  }
  return totals;
}

export type SessionPoint = {
  sessionId: string;
  dayId: string;
  dayLabel: string;
  startedAt: string;
  sets: number;
  reps: number;
  volume: number;
};

// Per-session aggregates in chronological order (oldest first) — the shape
// the session trend chart plots.
export function sessionSeries(sessions: Session[]): SessionPoint[] {
  return sessions
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const stats = sessionStats(session);
      return {
        sessionId: session.id,
        dayId: session.dayId,
        dayLabel: session.dayLabel,
        startedAt: session.startedAt,
        sets: stats.sets,
        reps: stats.reps,
        volume: stats.volume,
      };
    });
}

export type ExerciseTotals = {
  exercise: string;
  sessions: number; // sessions that logged at least one set of it
  sets: number;
  reps: number;
  volume: number;
};

// Lifetime per-exercise totals, sorted by the given metric descending (ties
// by name) — the shape the per-exercise bar chart plots.
export function exerciseTotals(sessions: Session[], sortBy: StatsMetric): ExerciseTotals[] {
  const byExercise = new Map<string, ExerciseTotals>();
  for (const session of sessions) {
    const countedThisSession = new Set<string>();
    for (const entry of session.entries) {
      if (entry.sets.length === 0) continue;
      let totals = byExercise.get(entry.exercise);
      if (!totals) {
        totals = { exercise: entry.exercise, sessions: 0, sets: 0, reps: 0, volume: 0 };
        byExercise.set(entry.exercise, totals);
      }
      if (!countedThisSession.has(entry.exercise)) {
        countedThisSession.add(entry.exercise);
        totals.sessions += 1;
      }
      addEntryStats(totals, entry);
    }
  }
  return [...byExercise.values()].toSorted(
    (a, b) => b[sortBy] - a[sortBy] || a.exercise.localeCompare(b.exercise),
  );
}

export type ExercisePoint = {
  sessionId: string;
  dayLabel: string;
  startedAt: string;
  sets: number;
  reps: number;
  volume: number;
};

// One exercise's per-session aggregates in chronological order (oldest
// first) — the shape the exercise trend chart plots. Duplicate entries for
// the exercise within a session are summed; set-less entries are skipped,
// matching lastEntryForExercise.
export function exerciseSeries(sessions: Session[], exercise: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const session of sessions) {
    const entries = session.entries.filter((e) => e.exercise === exercise && e.sets.length > 0);
    if (entries.length === 0) continue;
    const point: ExercisePoint = {
      sessionId: session.id,
      dayLabel: session.dayLabel,
      startedAt: session.startedAt,
      sets: 0,
      reps: 0,
      volume: 0,
    };
    for (const entry of entries) {
      addEntryStats(point, entry);
    }
    points.push(point);
  }
  return points.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// Most recent session — excluding the one in progress — that logged this
// exercise, so the UI can surface "what you lifted last time" set by set.
export function lastEntryForExercise(
  sessions: Session[],
  exercise: string,
  excludeSessionId?: string,
): { session: Session; entry: ExerciseEntry } | null {
  let best: { session: Session; entry: ExerciseEntry } | null = null;
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue;
    if (best && session.startedAt.localeCompare(best.session.startedAt) <= 0) continue;
    const entry = session.entries.find((e) => e.exercise === exercise && e.sets.length > 0);
    if (entry) best = { session, entry };
  }
  return best;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Fuller date for the history view, where sessions can span months/years —
// unlike formatDate, which stays compact ("Jun 23") for the inline "last time".
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSet(set: { reps: number; weight: number }): string {
  return `${set.weight} kg × ${set.reps}`;
}
