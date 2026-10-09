// Heavy barbell A/B split: three compounds at the top of each day, then
// accessories. Rep targets are the middle of the source routine's ranges
// (3-5 -> 4, 5-8 -> 6, 6-8 -> 7), because `reps` is a single integer target
// and the middle is the honest one to aim at.
//
// Romanian Deadlift, Incline Dumbbell Press and Lat Pulldown are shared with
// lib/plan-dumbbell-hybrid.ts by name on purpose, so this plan inherits their
// logged history, PRs and "last time" reference from day one. sets/reps may
// differ: a different prescription is the whole point of a second plan.

import type { PlanDay } from "./workouts";

export const barbellStrengthDays: PlanDay[] = [
  {
    id: "day-strength-a",
    label: "Strength A",
    title: "Squat · Bench · Row",
    focus: "Legs, Chest, Back & Arms",
    exercises: [
      {
        name: "Barbell Back Squat",
        sets: 4,
        reps: 4,
      },
      {
        name: "Barbell Bench Press",
        sets: 4,
        reps: 4,
      },
      {
        name: "Cable Row",
        sets: 4,
        reps: 4,
      },
      {
        name: "Seated Dumbbell Overhead Press",
        sets: 3,
        reps: 6,
      },
      {
        name: "Cable Push Out",
        sets: 3,
        reps: 7,
      },
      {
        name: "Calf Raises",
        sets: 3,
        reps: 10,
      },
    ],
  },
  {
    id: "day-strength-b",
    label: "Strength B",
    title: "Hinge · Incline · Pull",
    focus: "Legs, Back, Chest & Arms",
    exercises: [
      {
        name: "Romanian Deadlift",
        sets: 4,
        reps: 4,
      },
      {
        name: "Incline Dumbbell Press",
        sets: 4,
        reps: 6,
      },
      {
        name: "Lat Pulldown",
        sets: 4,
        reps: 6,
      },
      {
        name: "Bulgarian Split Squat",
        sets: 3,
        reps: 7,
      },
      {
        name: "Barbell Curl",
        sets: 3,
        reps: 7,
      },
      {
        name: "Lateral Raises",
        sets: 3,
        reps: 10,
      },
    ],
  },
];
