import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type LoggedSet,
  type Session,
  entryVolume,
  formatDate,
  formatSet,
  lastEntryForExercise,
  parseRepsInput,
  parseSessionsBlob,
  parseWeightInput,
  sessionStats,
  todayKey,
} from "./sessions";

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

describe("parseSessionsBlob", () => {
  it("treats a missing or empty payload as an empty history", () => {
    expect(parseSessionsBlob(null)).toEqual({ kind: "ok", sessions: [] });
    expect(parseSessionsBlob("")).toEqual({ kind: "ok", sessions: [] });
  });

  it("accepts a valid payload unchanged", () => {
    const stored = [makeSession()];

    const result = parseSessionsBlob(JSON.stringify(stored));

    expect(result).toEqual({ kind: "ok", sessions: stored });
  });

  it("strips unknown keys from stored data", () => {
    const stored = [{ ...makeSession(), legacyField: "junk" }];

    const result = parseSessionsBlob(JSON.stringify(stored));

    expect(result.sessions[0]).not.toHaveProperty("legacyField");
  });

  it("reports unparseable JSON as corrupt with no sessions", () => {
    expect(parseSessionsBlob("{garbage")).toEqual({ kind: "corrupt", sessions: [] });
  });

  it("reports a non-array payload as corrupt", () => {
    expect(parseSessionsBlob('{"not":"an array"}')).toEqual({ kind: "corrupt", sessions: [] });
  });

  it("drops invalid sessions individually and keeps the rest", () => {
    const good = makeSession();
    const badWeight = makeSession({
      id: "session-2",
      entries: [{ exercise: "Squat", sets: [{ id: "s", reps: 8, weight: "80" }] }],
    } as unknown as Partial<Session>);

    const result = parseSessionsBlob(JSON.stringify([good, badWeight]));

    expect(result).toEqual({ kind: "partial", sessions: [good], dropped: 1 });
  });

  it("rejects sessions with malformed fields", () => {
    const cases: unknown[] = [
      { ...makeSession(), dateKey: "22/07/2026" },
      { ...makeSession(), startedAt: "not-a-date" },
      { ...makeSession(), id: "" },
      { ...makeSession(), entries: "nope" },
      { ...makeSession(), entries: [{ exercise: "Squat", sets: [makeSet({ reps: -1 })] }] },
      { ...makeSession(), entries: [{ exercise: "Squat", sets: [makeSet({ weight: NaN })] }] },
    ];

    const result = parseSessionsBlob(JSON.stringify(cases));

    // NaN serializes to null, so the last case fails on the weight type check.
    expect(result).toEqual({ kind: "partial", sessions: [], dropped: cases.length });
  });
});

describe("lastEntryForExercise", () => {
  it("returns the most recent session that logged the exercise", () => {
    const older = makeSession({ id: "a", startedAt: "2026-07-10T10:00:00.000Z" });
    const newer = makeSession({ id: "b", startedAt: "2026-07-18T10:00:00.000Z" });

    const result = lastEntryForExercise([older, newer], "Bench Press");

    expect(result?.session.id).toBe("b");
  });

  it("excludes the in-progress session", () => {
    const prior = makeSession({ id: "a", startedAt: "2026-07-10T10:00:00.000Z" });
    const inProgress = makeSession({ id: "b", startedAt: "2026-07-18T10:00:00.000Z" });

    const result = lastEntryForExercise([prior, inProgress], "Bench Press", "b");

    expect(result?.session.id).toBe("a");
  });

  it("returns null when no prior session logged the exercise", () => {
    expect(lastEntryForExercise([makeSession()], "Deadlift")).toBeNull();
  });

  it("returns the entry that actually holds sets, not an earlier empty one", () => {
    // Regression: the old implementation matched the session on "any entry
    // with sets" but then returned the first name-matching entry, which
    // could be a different, empty entry for the same exercise.
    const withDuplicateEntries = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [] },
        { exercise: "Bench Press", sets: [makeSet()] },
      ],
    });

    const result = lastEntryForExercise([withDuplicateEntries], "Bench Press");

    expect(result?.entry.sets).toHaveLength(1);
  });
});

describe("session aggregation", () => {
  it("sums entry volume as Σ weight × reps", () => {
    const entry = {
      exercise: "Bench Press",
      sets: [makeSet({ weight: 80, reps: 8 }), makeSet({ id: "set-2", weight: 100, reps: 5 })],
    };

    expect(entryVolume(entry)).toBe(80 * 8 + 100 * 5);
  });

  it("aggregates sets, reps, and volume across all entries", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet({ weight: 80, reps: 8 })] },
        {
          exercise: "Squat",
          sets: [
            makeSet({ id: "set-2", weight: 100, reps: 5 }),
            makeSet({ id: "set-3", weight: 0, reps: 12 }),
          ],
        },
      ],
    });

    expect(sessionStats(session)).toEqual({
      sets: 3,
      reps: 8 + 5 + 12,
      volume: 80 * 8 + 100 * 5,
    });
  });
});

describe("logging-input parsing", () => {
  it("accepts positive integer reps within the bound", () => {
    expect(parseRepsInput("8")).toBe(8);
    expect(parseRepsInput(" 12 ")).toBe(12);
    expect(parseRepsInput("500")).toBe(500);
  });

  it("rejects reps that are empty, zero, fractional, or out of bounds", () => {
    expect(parseRepsInput("")).toBeNull();
    expect(parseRepsInput("0")).toBeNull();
    expect(parseRepsInput("8.5")).toBeNull();
    expect(parseRepsInput("501")).toBeNull();
  });

  it("treats empty weight as bodyweight and accepts dot or comma decimals", () => {
    expect(parseWeightInput("")).toBe(0);
    expect(parseWeightInput("80")).toBe(80);
    expect(parseWeightInput("82.5")).toBe(82.5);
    expect(parseWeightInput("82,5")).toBe(82.5);
    expect(parseWeightInput("1000")).toBe(1000);
  });

  it("rejects malformed or out-of-bounds weight", () => {
    expect(parseWeightInput("1.2.3")).toBeNull();
    expect(parseWeightInput("-5")).toBeNull();
    expect(parseWeightInput("80kg")).toBeNull();
    expect(parseWeightInput("1001")).toBeNull();
  });
});

describe("date formatting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keys today by the local calendar date", () => {
    // Local-time constructor, so the expectation holds in any timezone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 15, 0, 0));

    expect(todayKey()).toBe("2026-07-22");
  });

  it("keys by local date even just after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 0, 0, 1));

    expect(todayKey()).toBe("2026-01-05");
  });

  it("formats a compact month + day", () => {
    // Exact day depends on the machine's timezone; assert the shape.
    expect(formatDate("2026-07-20T10:00:00.000Z")).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it("formats a set as weight × reps", () => {
    expect(formatSet({ weight: 80, reps: 8 })).toBe("80 kg × 8");
    expect(formatSet({ weight: 0, reps: 12 })).toBe("0 kg × 12");
  });
});
