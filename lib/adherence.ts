// Progress against the plan's set targets — the join of lib/workouts.ts (what
// the plan prescribes) and lib/sessions.ts (what was logged). Lives in its own
// module so the session model stays plan-agnostic.

import type { Session } from "./sessions";
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
