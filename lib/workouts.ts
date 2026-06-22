export type Movement = "push" | "pull" | "hinge" | "squat";

export type Exercise = {
  name: string;
  sets: number;
  reps: number;
  muscles: string[];
  movement: Movement;
  youtube: string;
};

export type WorkoutDay = {
  id: string;
  label: string;
  title: string;
  focus: string;
  exercises: Exercise[];
};

export const workouts: WorkoutDay[] = [
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
        muscles: ["Chest", "Shoulders"],
        movement: "push",
        youtube: "https://www.youtube.com/results?search_query=incline+dumbbell+press+form",
      },
      {
        name: "Romanian Deadlift",
        sets: 3,
        reps: 12,
        muscles: ["Legs"],
        movement: "hinge",
        youtube: "https://www.youtube.com/results?search_query=romanian+deadlift+form",
      },
      {
        name: "Walking Lunges",
        sets: 3,
        reps: 10,
        muscles: ["Legs"],
        movement: "push",
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
        name: "Bent-Over Barbell Rows",
        sets: 4,
        reps: 8,
        muscles: ["Back", "Biceps"],
        movement: "pull",
        youtube: "https://www.youtube.com/results?search_query=bent+over+barbell+row+form",
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
        movement: "pull",
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

export const movementLabels: Record<Movement, string> = {
  push: "Push",
  pull: "Pull",
  hinge: "Hinge",
  squat: "Squat",
};
