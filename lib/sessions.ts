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

// Validate an already-parsed value as a sessions array. Invalid sessions are
// dropped individually, so one bad element doesn't cost the whole history.
// Shared by the localStorage load and the backup import so both go through the
// exact same trust-boundary validation.
export function parseSessionsArray(parsed: unknown): ParsedSessions {
  if (!Array.isArray(parsed)) return { kind: "corrupt", sessions: [] };
  const sessions: Session[] = [];
  for (const candidate of parsed) {
    const session = parseSession(candidate);
    if (session) sessions.push(session);
  }
  const dropped = parsed.length - sessions.length;
  return dropped > 0 ? { kind: "partial", sessions, dropped } : { kind: "ok", sessions };
}

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
  return parseSessionsArray(parsed);
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

// The two mutations the logging UI performs, as pure state transitions so the
// lazy-creation and pruning rules are testable without React. The caller
// (SessionProvider) supplies ids and timestamps — same convention as
// serializeBackup's exportedAt.

// Append `set` to the session identified by `target`'s (dayId, dateKey),
// creating the session and the exercise entry lazily. `target`'s id and
// startedAt only apply when the session doesn't exist yet. Only the changed
// path gets new references; untouched sessions keep their identity.
export function addSetToSessions(
  sessions: Session[],
  target: Omit<Session, "entries">,
  exercise: string,
  set: LoggedSet,
): Session[] {
  const next = sessions.slice();
  const idx = next.findIndex((s) => s.dayId === target.dayId && s.dateKey === target.dateKey);
  let session: Session;
  if (idx === -1) {
    session = { ...target, entries: [] };
    next.push(session);
  } else {
    session = { ...next[idx], entries: next[idx].entries.slice() };
    next[idx] = session;
  }
  const entryIdx = session.entries.findIndex((e) => e.exercise === exercise);
  if (entryIdx === -1) {
    session.entries.push({ exercise, sets: [set] });
  } else {
    session.entries[entryIdx] = {
      ...session.entries[entryIdx],
      sets: [...session.entries[entryIdx].sets, set],
    };
  }
  return next;
}

// Drop one logged set, pruning the entry — and then the session — when it
// empties out, so no view has to render a shell with nothing in it.
export function removeSetFromSessions(
  sessions: Session[],
  sessionId: string,
  exercise: string,
  setId: string,
): Session[] {
  return sessions
    .map((s) => {
      if (s.id !== sessionId) return s;
      const entries = s.entries
        .map((e) =>
          e.exercise === exercise ? { ...e, sets: e.sets.filter((set) => set.id !== setId) } : e,
        )
        .filter((e) => e.sets.length > 0);
      return { ...s, entries };
    })
    .filter((s) => s.entries.length > 0);
}

// Overwrite one logged set's reps/weight in place, preserving its id and
// position. Only the changed path gets new references; nothing matching — or
// values that already hold — returns `sessions` itself, so a no-op edit never
// triggers a save.
export function updateSetInSessions(
  sessions: Session[],
  sessionId: string,
  exercise: string,
  setId: string,
  values: { reps: number; weight: number },
): Session[] {
  const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
  if (sessionIdx === -1) return sessions;
  const session = sessions[sessionIdx];
  const entryIdx = session.entries.findIndex((e) => e.exercise === exercise);
  if (entryIdx === -1) return sessions;
  const entry = session.entries[entryIdx];
  const setIdx = entry.sets.findIndex((set) => set.id === setId);
  if (setIdx === -1) return sessions;
  const set = entry.sets[setIdx];
  if (set.reps === values.reps && set.weight === values.weight) return sessions;
  const sets = entry.sets.slice();
  sets[setIdx] = { ...set, reps: values.reps, weight: values.weight };
  const entries = session.entries.slice();
  entries[entryIdx] = { ...entry, sets };
  const next = sessions.slice();
  next[sessionIdx] = { ...session, entries };
  return next;
}

// Everything needed to put a deleted set back exactly where it was, including
// recreating the entry — and the session — that the removal may have pruned.
export type SetRemoval = {
  session: Omit<Session, "entries">;
  exercise: string;
  set: LoggedSet;
  sessionIndex: number;
  entryIndex: number;
  setIndex: number;
};

// removeSetFromSessions plus a capture of what was removed and where, so the
// deletion can be undone. `removed` is null — and `sessions` returned as the
// same reference — when nothing matched.
export function removeSetWithUndo(
  sessions: Session[],
  sessionId: string,
  exercise: string,
  setId: string,
): { sessions: Session[]; removed: SetRemoval | null } {
  const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
  if (sessionIndex === -1) return { sessions, removed: null };
  const session = sessions[sessionIndex];
  const entryIndex = session.entries.findIndex((e) => e.exercise === exercise);
  if (entryIndex === -1) return { sessions, removed: null };
  const setIndex = session.entries[entryIndex].sets.findIndex((set) => set.id === setId);
  if (setIndex === -1) return { sessions, removed: null };
  const removed: SetRemoval = {
    session: {
      id: session.id,
      dayId: session.dayId,
      dayLabel: session.dayLabel,
      dateKey: session.dateKey,
      startedAt: session.startedAt,
    },
    exercise,
    set: session.entries[entryIndex].sets[setIndex],
    sessionIndex,
    entryIndex,
    setIndex,
  };
  return { sessions: removeSetFromSessions(sessions, sessionId, exercise, setId), removed };
}

// Reinsert a captured removal. The session is looked up by (dayId, dateKey) —
// the same key addSetToSessions uses — so undoing after the pruned session was
// recreated under a new id never yields two sessions for one (day, date). A
// pruned entry or session is rebuilt with its original identity at its
// original (clamped) index; a set with the same id already present makes this
// a no-op returning `sessions` itself, so a stale undo stays safe.
export function restoreRemovedSet(sessions: Session[], removal: SetRemoval): Session[] {
  const next = sessions.slice();
  let sessionIdx = next.findIndex(
    (s) => s.dayId === removal.session.dayId && s.dateKey === removal.session.dateKey,
  );
  let session: Session;
  if (sessionIdx === -1) {
    session = { ...removal.session, entries: [] };
    sessionIdx = Math.min(removal.sessionIndex, next.length);
    next.splice(sessionIdx, 0, session);
  } else {
    session = { ...next[sessionIdx], entries: next[sessionIdx].entries.slice() };
    next[sessionIdx] = session;
  }
  let entryIdx = session.entries.findIndex((e) => e.exercise === removal.exercise);
  let entry: ExerciseEntry;
  if (entryIdx === -1) {
    entry = { exercise: removal.exercise, sets: [] };
    entryIdx = Math.min(removal.entryIndex, session.entries.length);
    session.entries.splice(entryIdx, 0, entry);
  } else {
    if (session.entries[entryIdx].sets.some((set) => set.id === removal.set.id)) return sessions;
    entry = { ...session.entries[entryIdx], sets: session.entries[entryIdx].sets.slice() };
    session.entries[entryIdx] = entry;
  }
  entry.sets.splice(Math.min(removal.setIndex, entry.sets.length), 0, removal.set);
  return next;
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

// Estimated one-rep max via the Epley formula: w × (1 + reps/30). A well-
// established estimate — accurate enough to track progression as a trend, and
// it needs no hardware beyond the weight+reps already logged. A bodyweight set
// (weight 0) has no external load to extrapolate, so it yields 0; a single rep
// returns the weight itself. Rounded to 0.1 kg so values compare cleanly.
export function estimatedOneRepMax(set: { weight: number; reps: number }): number {
  if (set.weight <= 0 || set.reps <= 0) return 0;
  // A single rep is already a 1RM — Epley only extrapolates multi-rep sets.
  if (set.reps === 1) return set.weight;
  return Math.round(set.weight * (1 + set.reps / 30) * 10) / 10;
}

// The highest estimated 1RM across an entry's sets (0 if none qualify).
export function entryBestOneRepMax(entry: ExerciseEntry): number {
  return entry.sets.reduce((best, set) => Math.max(best, estimatedOneRepMax(set)), 0);
}

// The set that produced the highest estimated 1RM (null when none qualify) —
// the actual logged lift behind a personal record, so the UI can show what was
// really performed rather than the extrapolated 1RM number.
export function bestOneRepMaxSet(sets: LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null;
  let bestEstimate = 0;
  for (const set of sets) {
    const estimate = estimatedOneRepMax(set);
    if (estimate > bestEstimate) {
      bestEstimate = estimate;
      best = set;
    }
  }
  return best;
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

// A calendar-date URL param is untrusted input: anything but a YYYY-MM-DD
// string is discarded (the same shape check a stored dateKey passes).
export function parseDateKeyParam(value: string | null): string | null {
  return value !== null && DATE_KEY_PATTERN.test(value) ? value : null;
}

// A dateKey names a local calendar day; build the Date from its parts —
// new Date("YYYY-MM-DD") would parse as UTC midnight and render a day off
// west of Greenwich.
export function dateKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Inverse of dateKeyToDate, following todayKey's local-date convention.
export function dateToDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

// Compact label for a dateKey ("Jul 19"); goes through the local Date so the
// shown day always matches the key.
export function formatDateKey(key: string): string {
  return dateKeyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Sessions whose calendar date falls inside the inclusive [from, to] range;
// a null bound is an open end. Date-only YYYY-MM-DD strings compare safely
// as strings — no timestamp math, no timezone involved.
export function filterSessionsByDateRange(
  sessions: Session[],
  from: string | null,
  to: string | null,
): Session[] {
  if (from === null && to === null) return sessions;
  return sessions.filter(
    (session) =>
      (from === null || session.dateKey >= from) && (to === null || session.dateKey <= to),
  );
}

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
  oneRepMax: number; // best estimated 1RM of that session's sets (0 if bodyweight)
};

// One exercise's per-session aggregates in chronological order (oldest
// first) — the shape the exercise trend chart plots. Duplicate entries for
// the exercise within a session are summed; set-less entries are skipped,
// matching lastEntryForExercise. oneRepMax is a max, not a sum — it tracks the
// heaviest estimated 1RM hit that session.
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
      oneRepMax: 0,
    };
    for (const entry of entries) {
      addEntryStats(point, entry);
      point.oneRepMax = Math.max(point.oneRepMax, entryBestOneRepMax(entry));
    }
    points.push(point);
  }
  return points.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// The best estimated 1RM ever hit for an exercise across the given sessions,
// optionally excluding the in-progress session — the bar a freshly logged set
// must clear to count as a personal record. 0 when the exercise has no prior
// loaded sets.
export function bestOneRepMaxForExercise(
  sessions: Session[],
  exercise: string,
  excludeSessionId?: string,
): number {
  let best = 0;
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue;
    for (const entry of session.entries) {
      if (entry.exercise !== exercise) continue;
      best = Math.max(best, entryBestOneRepMax(entry));
    }
  }
  return best;
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

// Estimated 1RM as a compact kg label; drops a trailing ".0" so whole numbers
// read cleanly ("120 kg", "117.5 kg").
export function formatOneRepMax(value: number): string {
  return `${Number(value.toFixed(1)).toLocaleString()} kg`;
}
