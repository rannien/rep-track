// The original Rep Track routine, kept selectable rather than replaced when
// the barbell plan arrived. Day ids are byte-for-byte what they always were —
// sessions key on (dayId, dateKey) and there is no migration layer, so
// renaming one would detach every session logged under it.
//
// Four exercises here are shared with lib/plan-barbell-strength.ts on purpose
// (Romanian Deadlift, Incline Dumbbell Press, Lat Pulldown, Overhead Triceps
// Extension), so their history, PRs and "last time" reference run
// continuously across a plan switch. Their muscles/movement/youtube must
// match there exactly — see the canonical-definition invariant in
// lib/workouts.test.ts.

import type { WorkoutDay } from "./workouts";

export const dumbbellHybridDays: WorkoutDay[] = [
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
        muscles: ["Chest", "Shoulders", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=incline+dumbbell+press+form",
      },
      {
        name: "Romanian Deadlift",
        sets: 4,
        reps: 8,
        muscles: ["Legs", "Back"],
        movement: "hinge",
        youtube: "https://www.youtube.com/results?search_query=romanian+deadlift+form",
      },
      {
        name: "Walking Lunges",
        sets: 3,
        reps: 10,
        muscles: ["Legs"],
        movement: "squat",
        youtube: "https://www.youtube.com/results?search_query=walking+lunges+form",
      },
      {
        name: "Lat Pulldown",
        sets: 4,
        reps: 8,
        muscles: ["Back", "Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=lat+pulldown+form",
      },
      {
        name: "Seated Arnold Press",
        sets: 4,
        reps: 8,
        muscles: ["Shoulders", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=seated+arnold+press+form",
      },
      {
        name: "Bent-Over Dumbbell Rows",
        sets: 4,
        reps: 8,
        muscles: ["Back", "Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=bent+over+dumbbell+row+form",
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
        muscles: ["Legs"],
        movement: "squat",
        youtube: "https://www.youtube.com/results?search_query=front+squat+form",
      },
      {
        name: "Pec Deck",
        sets: 4,
        reps: 8,
        muscles: ["Chest"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=pec+deck+machine+form",
      },
      {
        name: "Close-Grip Bench Press",
        sets: 4,
        reps: 8,
        muscles: ["Chest", "Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=close+grip+bench+press+form",
      },
      {
        name: "Face Pull",
        sets: 4,
        reps: 8,
        muscles: ["Shoulders", "Back"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=face+pull+form",
      },
      {
        name: "Overhead Triceps Extension",
        sets: 4,
        reps: 8,
        muscles: ["Triceps"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=overhead+triceps+extension+form",
      },
      {
        name: "Hammer Curls",
        sets: 4,
        reps: 8,
        muscles: ["Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=hammer+curls+form",
      },
    ],
  },
];
