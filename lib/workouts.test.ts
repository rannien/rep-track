import { describe, expect, it } from "vitest";
import { workouts } from "./workouts";

// The plan is hand-edited data, and parts of it act as identifiers: day ids
// key sessions, and an exercise's *name* is the join key between the plan and
// every logged set (entries store the name, not an id). These invariants are
// what a typo in lib/workouts.ts would silently break — the type system can't
// check any of them.

describe("workout plan data integrity", () => {
  it("keeps day ids unique", () => {
    const ids = workouts.map((day) => day.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every day an id, label, title, and focus", () => {
    for (const day of workouts) {
      expect(day.id).not.toBe("");
      expect(day.label).not.toBe("");
      expect(day.title).not.toBe("");
      expect(day.focus).not.toBe("");
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it("keeps exercise names unique within a day", () => {
    // Two same-named exercises on one day would share a single log entry —
    // sets logged under either would merge into one history.
    for (const day of workouts) {
      const names = day.exercises.map((exercise) => exercise.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("gives every exercise a name, positive integer sets/reps, and muscles", () => {
    for (const day of workouts) {
      for (const exercise of day.exercises) {
        expect(exercise.name).not.toBe("");
        expect(Number.isInteger(exercise.sets) && exercise.sets > 0).toBe(true);
        expect(Number.isInteger(exercise.reps) && exercise.reps > 0).toBe(true);
        expect(exercise.muscles.length).toBeGreaterThan(0);
        for (const muscle of exercise.muscles) expect(muscle).not.toBe("");
      }
    }
  });

  it("links every exercise to a YouTube form search", () => {
    for (const day of workouts) {
      for (const exercise of day.exercises) {
        expect(exercise.youtube).toMatch(/^https:\/\/www\.youtube\.com\//);
      }
    }
  });
});
