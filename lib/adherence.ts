// Progress against the plan's set targets — the join of lib/workouts.ts (what
// the plan prescribes) and lib/sessions.ts (what was logged). Lives in its own
// module so the session model stays plan-agnostic.

import { type Session, type StatsMetric, entryVolume } from "./sessions";
import type { Exercise, WorkoutDay } from "./workouts";

export type ExerciseProgress = {
  logged: number; // sets logged this session for the exercise
  target: number; // the plan's prescribed set count
  met: boolean;
};

// Sets logged vs the plan target for one exercise. Duplicate entries for the
// same name (backup import can produce them) are summed, matching
// exerciseSeries. `logged` is unclamped so overshooting reads honestly (5/4).
export function exerciseProgress(
  session: Session | undefined,
  exercise: Pick<Exercise, "name" | "sets">,
): ExerciseProgress {
  let logged = 0;
  if (session) {
    for (const entry of session.entries) {
      if (entry.exercise === exercise.name) logged += entry.sets.length;
    }
  }
  const target = exercise.sets;
  return { logged, target, met: target > 0 && logged >= target };
}

export type DayProgress = {
  completedSets: number;
  targetSets: number;
  fraction: number; // completedSets / targetSets; 0 when the day has no targets
  done: boolean;
};

// How far through the day's plan a session is. Each exercise contributes at
// most its target — extra sets of one lift can't mask a skipped one — so
// `done` and a full bar mean every prescribed exercise hit its set count.
// Off-plan entries (imported history) are never visited.
export function dayProgress(day: WorkoutDay, session: Session | undefined): DayProgress {
  let completedSets = 0;
  let targetSets = 0;
  for (const exercise of day.exercises) {
    const { logged, target } = exerciseProgress(session, exercise);
    completedSets += Math.min(logged, target);
    targetSets += target;
  }
  return {
    completedSets,
    targetSets,
    fraction: targetSets > 0 ? completedSets / targetSets : 0,
    done: targetSets > 0 && completedSets >= targetSets,
  };
}

export type MuscleTotals = {
  muscle: string; // a plan muscle group, or OTHER_MUSCLE for off-plan exercises
  sets: number;
  reps: number;
  volume: number;
};

// Bucket for logged exercises the plan doesn't know (imported history,
// retired plan entries) — their work is real, so it stays visible.
export const OTHER_MUSCLE = "Other";

// Per-muscle-group totals across the given sessions. An exercise credits its
// full sets/reps/volume to every muscle it lists — simple and honest about
// involvement, at the cost of the columns not summing to the session totals
// (the UI copy says so). The plan is a parameter so tests stay synthetic.
// Sorted by the given metric descending (ties by name), OTHER_MUSCLE always
// last.
export function muscleTotals(
  sessions: Session[],
  days: WorkoutDay[],
  sortBy: StatsMetric,
): MuscleTotals[] {
  const musclesByExercise = new Map<string, string[]>();
  for (const day of days) {
    for (const exercise of day.exercises) {
      musclesByExercise.set(exercise.name, exercise.muscles);
    }
  }
  const byMuscle = new Map<string, MuscleTotals>();
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.sets.length === 0) continue;
      const muscles = musclesByExercise.get(entry.exercise) ?? [OTHER_MUSCLE];
      const reps = entry.sets.reduce((sum, set) => sum + set.reps, 0);
      const volume = entryVolume(entry);
      for (const muscle of muscles.length > 0 ? muscles : [OTHER_MUSCLE]) {
        let totals = byMuscle.get(muscle);
        if (!totals) {
          totals = { muscle, sets: 0, reps: 0, volume: 0 };
          byMuscle.set(muscle, totals);
        }
        totals.sets += entry.sets.length;
        totals.reps += reps;
        totals.volume += volume;
      }
    }
  }
  return [...byMuscle.values()].toSorted((a, b) => {
    if (a.muscle === OTHER_MUSCLE) return 1;
    if (b.muscle === OTHER_MUSCLE) return -1;
    return b[sortBy] - a[sortBy] || a.muscle.localeCompare(b.muscle);
  });
}
