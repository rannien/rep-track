import { describe, expect, it } from "vitest";
import { OTHER_MUSCLE, dayProgress, exerciseProgress, muscleTotals } from "./adherence";
import type { LoggedSet, Session } from "./sessions";
import type { Exercise, WorkoutDay } from "./workouts";

// Synthetic fixtures, not the real plan — hand-editing lib/workouts.ts must
// never break these tests.

let setCounter = 0;

function makeSets(count: number): LoggedSet[] {
  return Array.from({ length: count }, () => ({
    id: `set-${++setCounter}`,
    reps: 8,
    weight: 80,
  }));
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    name: "Bench Press",
    sets: 4,
    reps: 8,
    muscles: ["Chest"],
    movement: "push",
    youtube: "https://www.youtube.com/results?search_query=bench+press+form",
    ...overrides,
  };
}

function makeDay(exercises: Exercise[]): WorkoutDay {
  return { id: "day-1", label: "Day 1", title: "Upper", focus: "Chest & Back", exercises };
}

function makeSession(entries: Session["entries"]): Session {
  return {
    id: "session-1",
    dayId: "day-1",
    dayLabel: "Day 1",
    dateKey: "2026-07-20",
    startedAt: "2026-07-20T10:00:00.000Z",
    entries,
  };
}

describe("exerciseProgress", () => {
  it("reports zero logged when there is no session yet", () => {
    expect(exerciseProgress(undefined, makeExercise())).toEqual({
      logged: 0,
      target: 4,
      met: false,
    });
  });

  it("reports zero logged when the session has no entry for the exercise", () => {
    const session = makeSession([{ exercise: "Row", sets: makeSets(3) }]);

    expect(exerciseProgress(session, makeExercise())).toEqual({ logged: 0, target: 4, met: false });
  });

  it("counts the entry's sets and stays unmet under target", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(2) }]);

    expect(exerciseProgress(session, makeExercise())).toEqual({ logged: 2, target: 4, met: false });
  });

  it("is met exactly at target", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(4) }]);

    expect(exerciseProgress(session, makeExercise())).toEqual({ logged: 4, target: 4, met: true });
  });

  it("reports over-target sets unclamped", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(5) }]);

    expect(exerciseProgress(session, makeExercise())).toEqual({ logged: 5, target: 4, met: true });
  });

  it("sums duplicate entries for the same exercise name", () => {
    const session = makeSession([
      { exercise: "Bench Press", sets: makeSets(2) },
      { exercise: "Bench Press", sets: makeSets(2) },
    ]);

    expect(exerciseProgress(session, makeExercise())).toEqual({ logged: 4, target: 4, met: true });
  });

  it("never reports a zero-target exercise as met", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(3) }]);

    expect(exerciseProgress(session, makeExercise({ sets: 0 }))).toEqual({
      logged: 3,
      target: 0,
      met: false,
    });
  });
});

describe("dayProgress", () => {
  const day = makeDay([
    makeExercise({ name: "Bench Press", sets: 4 }),
    makeExercise({ name: "Row", sets: 3 }),
  ]);

  it("reports an untouched day when there is no session yet", () => {
    expect(dayProgress(day, undefined)).toEqual({
      completedSets: 0,
      targetSets: 7,
      fraction: 0,
      done: false,
    });
  });

  it("sums partial completion across exercises", () => {
    const session = makeSession([
      { exercise: "Bench Press", sets: makeSets(2) },
      { exercise: "Row", sets: makeSets(1) },
    ]);

    expect(dayProgress(day, session)).toEqual({
      completedSets: 3,
      targetSets: 7,
      fraction: 3 / 7,
      done: false,
    });
  });

  it("clamps each exercise to its target so extras cannot mask a skipped one", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(6) }]);

    expect(dayProgress(day, session)).toEqual({
      completedSets: 4,
      targetSets: 7,
      fraction: 4 / 7,
      done: false,
    });
  });

  it("ignores off-plan exercises entirely", () => {
    const session = makeSession([{ exercise: "Imported Curls", sets: makeSets(5) }]);

    expect(dayProgress(day, session)).toEqual({
      completedSets: 0,
      targetSets: 7,
      fraction: 0,
      done: false,
    });
  });

  it("is done with fraction exactly 1 when every target is met, even over-target", () => {
    const session = makeSession([
      { exercise: "Bench Press", sets: makeSets(5) },
      { exercise: "Row", sets: makeSets(3) },
    ]);

    expect(dayProgress(day, session)).toEqual({
      completedSets: 7,
      targetSets: 7,
      fraction: 1,
      done: true,
    });
  });

  it("reports a day with no exercises as zero, never NaN", () => {
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(2) }]);

    expect(dayProgress(makeDay([]), session)).toEqual({
      completedSets: 0,
      targetSets: 0,
      fraction: 0,
      done: false,
    });
  });
});

describe("muscleTotals", () => {
  const days = [
    makeDay([
      makeExercise({ name: "Bench Press", muscles: ["Chest", "Triceps"] }),
      makeExercise({ name: "Row", muscles: ["Back"] }),
    ]),
  ];

  it("returns nothing for an empty history", () => {
    expect(muscleTotals([], days, "volume")).toEqual([]);
  });

  it("credits an exercise's full work to every muscle it lists", () => {
    // 2 sets × 8 reps × 80 kg
    const session = makeSession([{ exercise: "Bench Press", sets: makeSets(2) }]);

    const totals = muscleTotals([session], days, "volume");

    expect(totals).toEqual([
      { muscle: "Chest", sets: 2, reps: 16, volume: 1280 },
      { muscle: "Triceps", sets: 2, reps: 16, volume: 1280 },
    ]);
  });

  it("buckets off-plan exercises under Other, always sorted last", () => {
    const session = makeSession([
      { exercise: "Imported Curls", sets: makeSets(5) },
      { exercise: "Row", sets: makeSets(1) },
    ]);

    const totals = muscleTotals([session], days, "volume");

    expect(totals.map((t) => t.muscle)).toEqual(["Back", OTHER_MUSCLE]);
    expect(totals[1]).toEqual({ muscle: OTHER_MUSCLE, sets: 5, reps: 40, volume: 3200 });
  });

  it("sorts by the requested metric descending, ties by name", () => {
    const session = makeSession([
      { exercise: "Bench Press", sets: makeSets(1) },
      { exercise: "Row", sets: makeSets(1) },
    ]);

    const totals = muscleTotals([session], days, "reps");

    // All three muscles tie on reps → alphabetical.
    expect(totals.map((t) => t.muscle)).toEqual(["Back", "Chest", "Triceps"]);
  });

  it("skips set-less entries", () => {
    const session = makeSession([{ exercise: "Row", sets: [] }]);

    expect(muscleTotals([session], days, "volume")).toEqual([]);
  });
});
