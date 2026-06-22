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

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
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

// Aggregate sets, reps, and volume for a session in a single pass.
export function sessionStats(session: Session): SessionStats {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      sets += 1;
      reps += set.reps;
      volume += set.weight * set.reps;
    }
  }
  return { sets, reps, volume };
}

// Most recent session — excluding the one in progress — that logged this
// exercise, so the UI can surface "what you lifted last time" set by set.
export function lastEntryForExercise(
  sessions: Session[],
  exercise: string,
  excludeSessionId?: string,
): { session: Session; entry: ExerciseEntry } | null {
  const session = sessions
    .filter((s) => s.id !== excludeSessionId)
    .filter((s) => s.entries.some((e) => e.exercise === exercise && e.sets.length > 0))
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (!session) return null;
  const entry = session.entries.find((e) => e.exercise === exercise)!;
  return { session, entry };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatSet(set: { reps: number; weight: number }): string {
  return `${set.weight > 0 ? `${set.weight} kg ` : ""}× ${set.reps}`;
}
