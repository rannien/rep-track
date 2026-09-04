// Heavy barbell A/B split: three compounds at the top of each day, then two
// accessories. Rep targets are the middle of the source routine's ranges
// (3-5 -> 4, 5-8 -> 6, 6-8 -> 7), because `reps` is a single integer target
// and the middle is the honest one to aim at.
//
// Romanian Deadlift, Incline Dumbbell Press and Lat Pulldown are shared with
// lib/plan-dumbbell-hybrid.ts by name on purpose, so this plan inherits their
// logged history, PRs and "last time" reference from day one. Their
// muscles/movement/youtube must match there exactly — see the
// canonical-definition invariant in lib/workouts.test.ts. sets/reps may
// differ: a different prescription is the whole point of a second plan.

import type { WorkoutDay } from "./workouts";

export const barbellStrengthDays: WorkoutDay[] = [
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
        muscles: ["Legs"],
        movement: "squat",
        youtube: "https://www.youtube.com/results?search_query=barbell+back+squat+form",
      },
      {
        name: "Barbell Bench Press",
        sets: 4,
        reps: 4,
        muscles: ["Chest", "Shoulders", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=barbell+bench+press+form",
      },
      {
        name: "Barbell Bent-Over Row",
        sets: 4,
        reps: 4,
        muscles: ["Back", "Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=barbell+bent+over+row+form",
      },
      {
        name: "Seated Dumbbell Overhead Press",
        sets: 3,
        reps: 6,
        muscles: ["Shoulders", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=seated+dumbbell+overhead+press+form",
      },
      {
        name: "Lying Triceps Extensions",
        sets: 3,
        reps: 7,
        muscles: ["Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=lying+triceps+extension+form",
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
        muscles: ["Legs", "Back"],
        movement: "hinge",
        youtube: "https://www.youtube.com/results?search_query=romanian+deadlift+form",
      },
      {
        name: "Incline Dumbbell Press",
        sets: 4,
        reps: 6,
        muscles: ["Chest", "Shoulders", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=incline+dumbbell+press+form",
      },
      {
        name: "Lat Pulldown",
        sets: 4,
        reps: 6,
        muscles: ["Back", "Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=lat+pulldown+form",
      },
      {
        name: "Bulgarian Split Squat",
        sets: 3,
        reps: 7,
        muscles: ["Legs"],
        movement: "squat",
        youtube: "https://www.youtube.com/results?search_query=bulgarian+split+squat+form",
      },
      {
        name: "Barbell Curl",
        sets: 3,
        reps: 7,
        muscles: ["Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=barbell+curl+form",
      },
    ],
  },
];
