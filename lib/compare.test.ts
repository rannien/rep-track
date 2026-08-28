import { describe, expect, it } from "vitest";
import {
  compareRecords,
  compareTotals,
  formatRecordsShareText,
  normalizeProfileName,
  parseComparisonProfile,
} from "./compare";
import type { LoggedSet, Session } from "./sessions";
import type { Exercise, WorkoutDay } from "./workouts";

function makeSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return { id: "set-1", reps: 8, weight: 80, ...overrides };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    dayId: "day-1",
    dayLabel: "Push",
    dateKey: "2026-07-20",
    startedAt: "2026-07-20T10:00:00.000Z",
    entries: [{ exercise: "Bench Press", sets: [makeSet()] }],
    ...overrides,
  };
}

function makeExercise(name: string): Exercise {
  return {
    name,
    sets: 4,
    reps: 8,
    muscles: ["Chest"],
    movement: "push",
    youtube: "https://www.youtube.com/results?search_query=form",
  };
}

// Synthetic plan, not the real one — editing lib/workouts.ts must not break this.
const days: WorkoutDay[] = [
  {
    id: "day-1",
    label: "Day 1",
    title: "Upper",
    focus: "Chest",
    exercises: [makeExercise("Bench Press"), makeExercise("Row")],
  },
];

describe("normalizeProfileName", () => {
  it("trims, caps, and falls back to a default", () => {
    expect(normalizeProfileName("  Anna  ")).toBe("Anna");
    expect(normalizeProfileName("   ")).toBe("Friend");
    expect(normalizeProfileName("x".repeat(60))).toHaveLength(40);
  });
});

describe("parseComparisonProfile", () => {
  const valid = {
    name: "Anna",
    importedAt: "2026-08-19T10:00:00.000Z",
    sessions: [makeSession()],
  };

  it("accepts a valid stored profile", () => {
    expect(parseComparisonProfile(JSON.stringify(valid))).toEqual(valid);
  });

  it("returns null for missing, unparseable, or malformed payloads", () => {
    const cases = [
      null,
      "",
      "{garbage",
      "[]",
      JSON.stringify({ ...valid, name: "  " }),
      JSON.stringify({ ...valid, name: 3 }),
      JSON.stringify({ ...valid, importedAt: "yesterday" }),
      JSON.stringify({ ...valid, sessions: "nope" }),
    ];
    for (const raw of cases) {
      expect(parseComparisonProfile(raw)).toBeNull();
    }
  });

  it("drops invalid sessions individually and normalizes the name", () => {
    const stored = {
      name: "  Anna  ",
      importedAt: valid.importedAt,
      sessions: [makeSession(), { ...makeSession({ id: "bad" }), dateKey: "22/07/2026" }],
    };

    const profile = parseComparisonProfile(JSON.stringify(stored));

    expect(profile?.name).toBe("Anna");
    expect(profile?.sessions).toHaveLength(1);
  });
});

describe("compareRecords", () => {
  it("joins both sides by exercise, plan order first, then off-plan alphabetically", () => {
    const mine = [
      makeSession({
        entries: [
          { exercise: "Row", sets: [makeSet({ weight: 60 })] },
          { exercise: "Zercher Squat", sets: [makeSet({ weight: 90 })] },
        ],
      }),
    ];
    const theirs = [
      makeSession({
        id: "friend-1",
        entries: [
          { exercise: "Bench Press", sets: [makeSet({ weight: 100 })] },
          { exercise: "Curl", sets: [makeSet({ weight: 20 })] },
        ],
      }),
    ];

    const result = compareRecords(mine, theirs, days);

    expect(result.map((r) => r.exercise)).toEqual(["Bench Press", "Row", "Curl", "Zercher Squat"]);
  });

  it("names the leader by total load, with ties and one-sided records", () => {
    const mine = [
      makeSession({
        entries: [
          { exercise: "Bench Press", sets: [makeSet({ weight: 80 })] },
          { exercise: "Row", sets: [makeSet({ weight: 60 })] },
          { exercise: "Only Mine", sets: [makeSet({ weight: 10 })] },
          // 2×16 = 32 total beats the friend's single 30.
          { exercise: "Lunges", sets: [{ ...makeSet({ weight: 16 }), double: true as const }] },
        ],
      }),
    ];
    const theirs = [
      makeSession({
        id: "friend-1",
        entries: [
          { exercise: "Bench Press", sets: [makeSet({ weight: 100 })] },
          { exercise: "Row", sets: [makeSet({ weight: 60, reps: 12 })] },
          { exercise: "Only Theirs", sets: [makeSet({ weight: 10 })] },
          { exercise: "Lunges", sets: [makeSet({ weight: 30 })] },
        ],
      }),
    ];

    const byExercise = new Map(compareRecords(mine, theirs, days).map((r) => [r.exercise, r]));

    expect(byExercise.get("Bench Press")?.leader).toBe("friend");
    expect(byExercise.get("Row")?.leader).toBe("tie"); // same load; reps don't break a tie
    expect(byExercise.get("Only Mine")?.leader).toBe("you");
    expect(byExercise.get("Only Mine")?.theirs).toBeNull();
    expect(byExercise.get("Only Theirs")?.leader).toBe("friend");
    expect(byExercise.get("Lunges")?.leader).toBe("you");
  });
});

describe("compareTotals", () => {
  it("adds a whole-kg average volume per session and never divides by zero", () => {
    const mine = [
      makeSession(), // 80 × 8 = 640
      makeSession({
        id: "s2",
        entries: [{ exercise: "Row", sets: [makeSet({ weight: 50, reps: 10 })] }], // 500
      }),
    ];

    const result = compareTotals(mine, []);

    expect(result.you.sessions).toBe(2);
    expect(result.you.avgVolumePerSession).toBe(570);
    expect(result.friend).toEqual({
      sessions: 0,
      sets: 0,
      reps: 0,
      volume: 0,
      avgVolumePerSession: 0,
    });
  });
});

describe("formatRecordsShareText", () => {
  it("lists one record per line in the display unit", () => {
    const text = formatRecordsShareText(
      [
        {
          exercise: "Bench Press",
          set: makeSet({ weight: 100 }),
          startedAt: "2026-07-20T10:00:00.000Z",
        },
        {
          exercise: "Lunges",
          set: { ...makeSet({ weight: 16, reps: 10 }), double: true as const },
          startedAt: "2026-07-20T10:00:00.000Z",
        },
      ],
      "kg",
    );

    expect(text).toBe("My Rep Track records\n• Bench Press — 100 kg × 8\n• Lunges — 2×16 kg × 10");
  });
});
