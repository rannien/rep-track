// The original Rep Track routine, kept selectable rather than replaced when
// the barbell plan arrived. Day ids are byte-for-byte what they always were —
// sessions key on (dayId, dateKey) and there is no migration layer, so
// renaming one would detach every session logged under it.
//
// Four exercises here are shared with lib/plan-barbell-strength.ts on purpose
// (Romanian Deadlift, Incline Dumbbell Press, Lat Pulldown, Overhead Triceps
// Extension), so their history, PRs and "last time" reference run
// continuously across a plan switch.

import type { PlanDay } from "./workouts";

export const dumbbellHybridDays: PlanDay[] = [
  {
    id: "day-a",
    label: "Day A",
    title: "Upper + Legs",
    focus: "Chest, Back, Shoulders & Legs",
    exercises: [
      {
        name: "Incline Dumbbell Press",
        sets: 4,
        reps: 8,
      },
      {
        name: "Romanian Deadlift",
        sets: 4,
        reps: 8,
      },
      {
        name: "Walking Lunges",
        sets: 3,
        reps: 10,
      },
      {
        name: "Lat Pulldown",
        sets: 4,
        reps: 8,
      },
      {
        name: "Seated Arnold Press",
        sets: 4,
        reps: 8,
      },
      {
        name: "Bent-Over Dumbbell Rows",
        sets: 4,
        reps: 8,
      },
    ],
  },
  {
    id: "day-b",
    label: "Day B",
    title: "Legs + Arms",
    focus: "Legs, Chest & Arms",
    exercises: [
      {
        name: "Front Squat",
        sets: 4,
        reps: 8,
      },
      {
        name: "Pec Deck",
        sets: 4,
        reps: 8,
      },
      {
        name: "Close-Grip Bench Press",
        sets: 4,
        reps: 8,
      },
      {
        name: "Face Pull",
        sets: 4,
        reps: 8,
      },
      {
        name: "Overhead Triceps Extension",
        sets: 4,
        reps: 8,
      },
      {
        name: "Hammer Curls",
        sets: 4,
        reps: 8,
      },
    ],
  },
];
