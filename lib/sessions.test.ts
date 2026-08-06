import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type LoggedSet,
  type Session,
  addSetToSessions,
  bestOneRepMaxForExercise,
  bestOneRepMaxSet,
  entryBestOneRepMax,
  entryVolume,
  dateKeyToDate,
  dateToDateKey,
  estimatedOneRepMax,
  exerciseSeries,
  exerciseTotals,
  filterSessionsByDateRange,
  formatDate,
  formatDateKey,
  formatOneRepMax,
  formatSet,
  lastEntryForExercise,
  parseDateKeyParam,
  parseRepsInput,
  parseSessionsBlob,
  parseWeightInput,
  removeSetFromSessions,
  removeSetWithUndo,
  restoreRemovedSet,
  sessionSeries,
  sessionStats,
  todayKey,
  totalStats,
  updateSetInSessions,
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

  it("neutralizes prototype-pollution keys in stored data", () => {
    // parseSession rebuilds every session field by field, so hostile keys in
    // a hand-edited payload must neither survive nor touch Object.prototype.
    const raw =
      '[{"id":"s1","dayId":"d1","dayLabel":"Push","dateKey":"2026-07-20",' +
      '"startedAt":"2026-07-20T10:00:00.000Z","entries":[],' +
      '"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}]';

    const result = parseSessionsBlob(raw);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.kind).toBe("ok");
    expect(Object.keys(result.sessions[0]).toSorted()).toEqual([
      "dateKey",
      "dayId",
      "dayLabel",
      "entries",
      "id",
      "startedAt",
    ]);
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

describe("addSetToSessions", () => {
  const target = {
    id: "new-session",
    dayId: "day-1",
    dayLabel: "Push",
    dateKey: "2026-07-22",
    startedAt: "2026-07-22T10:00:00.000Z",
  };

  it("creates the day's session with the supplied identity on the first set", () => {
    const set = makeSet();

    const result = addSetToSessions([], target, "Bench Press", set);

    expect(result).toEqual([{ ...target, entries: [{ exercise: "Bench Press", sets: [set] }] }]);
  });

  it("appends to the exercise's entry when today's session already exists", () => {
    const existing = makeSession({ dateKey: target.dateKey, dayId: target.dayId });
    const second = makeSet({ id: "set-2", weight: 85 });

    const result = addSetToSessions([existing], target, "Bench Press", second);

    // The existing session keeps its identity — target's id is not applied.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(existing.id);
    expect(result[0].entries[0].sets.map((s) => s.id)).toEqual(["set-1", "set-2"]);
  });

  it("starts a new entry for an exercise not yet logged today", () => {
    const existing = makeSession({ dateKey: target.dateKey, dayId: target.dayId });

    const result = addSetToSessions([existing], target, "Squat", makeSet({ id: "set-2" }));

    expect(result[0].entries.map((e) => e.exercise)).toEqual(["Bench Press", "Squat"]);
  });

  it("keys the session by (day, date): another day or date gets its own session", () => {
    const otherDay = makeSession({ id: "other", dayId: "day-2", dateKey: target.dateKey });
    const otherDate = makeSession({ id: "older", dayId: target.dayId, dateKey: "2026-07-20" });

    const result = addSetToSessions([otherDay, otherDate], target, "Bench Press", makeSet());

    expect(result).toHaveLength(3);
    expect(result[2].id).toBe(target.id);
  });

  it("leaves untouched sessions with their original references", () => {
    const existing = makeSession({ dateKey: target.dateKey, dayId: target.dayId });
    const unrelated = makeSession({ id: "other", dayId: "day-2" });

    const result = addSetToSessions([unrelated, existing], target, "Bench Press", makeSet());

    expect(result[0]).toBe(unrelated);
    expect(result[1]).not.toBe(existing);
  });
});

describe("removeSetFromSessions", () => {
  it("removes only the targeted set", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });

    const result = removeSetFromSessions([session], session.id, "Bench Press", "set-1");

    expect(result[0].entries[0].sets.map((s) => s.id)).toEqual(["set-2"]);
  });

  it("prunes an entry that loses its last set, keeping the session", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet()] },
        { exercise: "Squat", sets: [makeSet({ id: "set-2" })] },
      ],
    });

    const result = removeSetFromSessions([session], session.id, "Bench Press", "set-1");

    expect(result[0].entries.map((e) => e.exercise)).toEqual(["Squat"]);
  });

  it("prunes the session once its last entry empties out", () => {
    const session = makeSession();

    expect(removeSetFromSessions([session], session.id, "Bench Press", "set-1")).toEqual([]);
  });

  it("leaves other sessions untouched by reference", () => {
    const unrelated = makeSession({ id: "other" });
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });

    const result = removeSetFromSessions([unrelated, session], session.id, "Bench Press", "set-1");

    expect(result[0]).toBe(unrelated);
  });

  it("changes nothing when the set id is unknown", () => {
    const session = makeSession();

    expect(removeSetFromSessions([session], session.id, "Bench Press", "nope")).toEqual([session]);
  });
});

describe("updateSetInSessions", () => {
  it("overwrites the targeted set's reps and weight, keeping id and order", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });

    const result = updateSetInSessions([session], session.id, "Bench Press", "set-1", {
      reps: 6,
      weight: 90,
    });

    expect(result[0].entries[0].sets).toEqual([
      { id: "set-1", reps: 6, weight: 90 },
      { id: "set-2", reps: 8, weight: 85 },
    ]);
  });

  it("leaves other sessions untouched by reference", () => {
    const unrelated = makeSession({ id: "other" });
    const session = makeSession();

    const result = updateSetInSessions([unrelated, session], session.id, "Bench Press", "set-1", {
      reps: 6,
      weight: 90,
    });

    expect(result[0]).toBe(unrelated);
    expect(result[1]).not.toBe(session);
  });

  it("returns the same array reference when session, exercise, or set is unknown", () => {
    const sessions = [makeSession()];

    expect(
      updateSetInSessions(sessions, "nope", "Bench Press", "set-1", { reps: 6, weight: 90 }),
    ).toBe(sessions);
    expect(
      updateSetInSessions(sessions, "session-1", "Squat", "set-1", { reps: 6, weight: 90 }),
    ).toBe(sessions);
    expect(
      updateSetInSessions(sessions, "session-1", "Bench Press", "nope", { reps: 6, weight: 90 }),
    ).toBe(sessions);
  });

  it("returns the same array reference when the values are unchanged", () => {
    const sessions = [makeSession()];

    expect(
      updateSetInSessions(sessions, "session-1", "Bench Press", "set-1", { reps: 8, weight: 80 }),
    ).toBe(sessions);
  });
});

describe("removeSetWithUndo", () => {
  it("removes exactly what removeSetFromSessions removes", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });

    const result = removeSetWithUndo([session], session.id, "Bench Press", "set-1");

    expect(result.sessions).toEqual(
      removeSetFromSessions([session], session.id, "Bench Press", "set-1"),
    );
  });

  it("captures the removed set, its containers' identity, and all indices", () => {
    const other = makeSession({ id: "other", dayId: "day-2" });
    const session = makeSession({
      entries: [
        { exercise: "Squat", sets: [makeSet({ id: "squat-1" })] },
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });

    const { removed } = removeSetWithUndo([other, session], session.id, "Bench Press", "set-2");

    expect(removed).toEqual({
      session: {
        id: session.id,
        dayId: session.dayId,
        dayLabel: session.dayLabel,
        dateKey: session.dateKey,
        startedAt: session.startedAt,
      },
      exercise: "Bench Press",
      set: { id: "set-2", reps: 8, weight: 85 },
      sessionIndex: 1,
      entryIndex: 1,
      setIndex: 1,
    });
  });

  it("returns null and the same array reference when nothing matched", () => {
    const sessions = [makeSession()];

    const result = removeSetWithUndo(sessions, "session-1", "Bench Press", "nope");

    expect(result.removed).toBeNull();
    expect(result.sessions).toBe(sessions);
  });
});

function removeAndRestore(sessions: Session[], sessionId: string, exercise: string, setId: string) {
  const { sessions: after, removed } = removeSetWithUndo(sessions, sessionId, exercise, setId);
  if (!removed) throw new Error("expected a removal");
  return restoreRemovedSet(after, removed);
}

describe("restoreRemovedSet", () => {
  it("round-trips a middle set back to its original position", () => {
    const session = makeSession({
      entries: [
        {
          exercise: "Bench Press",
          sets: [makeSet(), makeSet({ id: "set-2", weight: 85 }), makeSet({ id: "set-3" })],
        },
      ],
    });

    expect(removeAndRestore([session], session.id, "Bench Press", "set-2")).toEqual([session]);
  });

  it("round-trips an entry's last set, recreating the entry at its original index", () => {
    const session = makeSession({
      entries: [
        { exercise: "Squat", sets: [makeSet({ id: "squat-1" })] },
        { exercise: "Bench Press", sets: [makeSet()] },
        { exercise: "Row", sets: [makeSet({ id: "row-1" })] },
      ],
    });

    expect(removeAndRestore([session], session.id, "Bench Press", "set-1")).toEqual([session]);
  });

  it("round-trips a session's last set, recreating the session with its identity", () => {
    const older = makeSession({ id: "older", dateKey: "2026-07-18" });
    const session = makeSession();
    const newer = makeSession({ id: "newer", dateKey: "2026-07-22" });

    const result = removeAndRestore([older, session, newer], session.id, "Bench Press", "set-1");

    expect(result).toEqual([older, session, newer]);
  });

  it("merges into the (dayId, dateKey) session even after its id changed", () => {
    const session = makeSession();
    const { sessions: pruned, removed } = removeSetWithUndo(
      [session],
      session.id,
      "Bench Press",
      "set-1",
    );
    if (!removed) throw new Error("expected a removal");
    // The pruned session gets recreated by a later addSet under a new id.
    const recreated = addSetToSessions(
      pruned,
      { ...removed.session, id: "new-session" },
      "Squat",
      makeSet({ id: "squat-1" }),
    );

    const result = restoreRemovedSet(recreated, removed);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("new-session");
    expect(result[0].entries).toEqual([
      { exercise: "Bench Press", sets: [makeSet()] },
      { exercise: "Squat", sets: [makeSet({ id: "squat-1" })] },
    ]);
  });

  it("clamps a stale set index beyond the current length", () => {
    const session = makeSession({
      entries: [
        {
          exercise: "Bench Press",
          sets: [makeSet(), makeSet({ id: "set-2" }), makeSet({ id: "set-3" })],
        },
      ],
    });
    const { sessions: after, removed } = removeSetWithUndo(
      [session],
      session.id,
      "Bench Press",
      "set-3",
    );
    if (!removed) throw new Error("expected a removal");
    // The sets before the removed one disappear before the undo fires.
    const shrunk = removeSetFromSessions(
      removeSetFromSessions(after, session.id, "Bench Press", "set-1"),
      session.id,
      "Bench Press",
      "set-2",
    );

    const result = restoreRemovedSet(shrunk, removed);

    expect(result[0].entries[0].sets.map((s) => s.id)).toEqual(["set-3"]);
  });

  it("is a no-op returning the same reference when the set already exists", () => {
    const session = makeSession();
    const { removed } = removeSetWithUndo([session], session.id, "Bench Press", "set-1");
    if (!removed) throw new Error("expected a removal");
    const sessions = [session];

    expect(restoreRemovedSet(sessions, removed)).toBe(sessions);
  });

  it("restores two removals LIFO back to the original array", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet(), makeSet({ id: "set-2", weight: 85 })] },
      ],
    });
    const first = removeSetWithUndo([session], session.id, "Bench Press", "set-1");
    const second = removeSetWithUndo(first.sessions, session.id, "Bench Press", "set-2");
    if (!first.removed || !second.removed) throw new Error("expected removals");

    const result = [second.removed, first.removed].reduce(restoreRemovedSet, second.sessions);

    expect(result).toEqual([session]);
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

describe("estimated 1RM & personal records", () => {
  it("estimates 1RM via Epley, rounded to 0.1 kg", () => {
    expect(estimatedOneRepMax({ weight: 100, reps: 1 })).toBe(100);
    expect(estimatedOneRepMax({ weight: 80, reps: 8 })).toBe(101.3); // 80 × (1 + 8/30)
    expect(estimatedOneRepMax({ weight: 100, reps: 5 })).toBe(116.7);
  });

  it("treats a bodyweight or empty set as having no estimable 1RM", () => {
    expect(estimatedOneRepMax({ weight: 0, reps: 12 })).toBe(0);
    expect(estimatedOneRepMax({ weight: 80, reps: 0 })).toBe(0);
  });

  it("takes the heaviest estimate across an entry's sets", () => {
    const entry = {
      exercise: "Bench Press",
      sets: [makeSet({ weight: 80, reps: 8 }), makeSet({ id: "s2", weight: 100, reps: 5 })],
    };

    expect(entryBestOneRepMax(entry)).toBe(116.7); // the 100 × 5 set wins
  });

  it("returns the actual set behind the best estimated 1RM", () => {
    const lighter = makeSet({ id: "a", weight: 80, reps: 8 }); // e1RM 101.3
    const record = makeSet({ id: "b", weight: 100, reps: 5 }); // e1RM 116.7

    expect(bestOneRepMaxSet([lighter, record])).toEqual(record);
  });

  it("has no PR set when nothing carries load", () => {
    expect(bestOneRepMaxSet([makeSet({ weight: 0, reps: 10 })])).toBeNull();
    expect(bestOneRepMaxSet([])).toBeNull();
  });

  it("finds the best prior 1RM for an exercise, excluding the in-progress session", () => {
    const older = makeSession({
      id: "a",
      startedAt: "2026-07-10T10:00:00.000Z",
      entries: [{ exercise: "Bench Press", sets: [makeSet({ weight: 100, reps: 5 })] }],
    });
    const inProgress = makeSession({
      id: "b",
      startedAt: "2026-07-18T10:00:00.000Z",
      entries: [{ exercise: "Bench Press", sets: [makeSet({ weight: 120, reps: 3 })] }],
    });

    expect(bestOneRepMaxForExercise([older, inProgress], "Bench Press")).toBe(132); // 120×3
    expect(bestOneRepMaxForExercise([older, inProgress], "Bench Press", "b")).toBe(116.7); // 100×5
  });

  it("returns 0 for an exercise with no loaded history", () => {
    expect(bestOneRepMaxForExercise([makeSession()], "Deadlift")).toBe(0);
  });

  it("formats a 1RM as kg, dropping a trailing .0", () => {
    expect(formatOneRepMax(120)).toBe("120 kg");
    expect(formatOneRepMax(117.5)).toBe("117.5 kg");
  });
});

describe("chart series", () => {
  it("returns zero totals for an empty history", () => {
    expect(totalStats([])).toEqual({ sessions: 0, sets: 0, reps: 0, volume: 0 });
  });

  it("sums totals across sessions", () => {
    const a = makeSession();
    const b = makeSession({
      id: "session-2",
      entries: [{ exercise: "Squat", sets: [makeSet({ id: "set-2", weight: 100, reps: 5 })] }],
    });

    expect(totalStats([a, b])).toEqual({
      sessions: 2,
      sets: 2,
      reps: 8 + 5,
      volume: 80 * 8 + 100 * 5,
    });
  });

  it("orders session points oldest first with per-session aggregates", () => {
    const newer = makeSession({ id: "b", startedAt: "2026-07-18T10:00:00.000Z" });
    const older = makeSession({
      id: "a",
      dayId: "day-2",
      dayLabel: "Pull",
      startedAt: "2026-07-10T10:00:00.000Z",
    });

    const result = sessionSeries([newer, older]);

    expect(result.map((p) => p.sessionId)).toEqual(["a", "b"]);
    expect(result[0]).toEqual({
      sessionId: "a",
      dayId: "day-2",
      dayLabel: "Pull",
      startedAt: "2026-07-10T10:00:00.000Z",
      sets: 1,
      reps: 8,
      volume: 80 * 8,
    });
  });

  it("merges an exercise's totals across sessions", () => {
    const a = makeSession({ id: "a", startedAt: "2026-07-10T10:00:00.000Z" });
    const b = makeSession({
      id: "b",
      startedAt: "2026-07-18T10:00:00.000Z",
      entries: [
        { exercise: "Bench Press", sets: [makeSet({ id: "set-2", weight: 100, reps: 5 })] },
      ],
    });

    expect(exerciseTotals([a, b], "volume")).toEqual([
      { exercise: "Bench Press", sessions: 2, sets: 2, reps: 8 + 5, volume: 80 * 8 + 100 * 5 },
    ]);
  });

  it("sorts by the requested metric with bodyweight sets counting reps but no volume", () => {
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet({ weight: 100, reps: 5 })] },
        { exercise: "Chin-Up", sets: [makeSet({ id: "set-2", weight: 0, reps: 12 })] },
      ],
    });

    expect(exerciseTotals([session], "volume").map((t) => t.exercise)).toEqual([
      "Bench Press",
      "Chin-Up",
    ]);
    expect(exerciseTotals([session], "reps").map((t) => t.exercise)).toEqual([
      "Chin-Up",
      "Bench Press",
    ]);
    expect(exerciseTotals([session], "reps")[0].volume).toBe(0);
  });

  it("breaks metric ties by exercise name", () => {
    const session = makeSession({
      entries: [
        { exercise: "Squat", sets: [makeSet()] },
        { exercise: "Bench Press", sets: [makeSet({ id: "set-2" })] },
      ],
    });

    expect(exerciseTotals([session], "volume").map((t) => t.exercise)).toEqual([
      "Bench Press",
      "Squat",
    ]);
  });

  it("ignores entries without sets", () => {
    const session = makeSession({
      entries: [{ exercise: "Bench Press", sets: [] }],
    });

    expect(exerciseTotals([session], "volume")).toEqual([]);
  });

  it("returns one chronological point per session that logged the exercise", () => {
    const newer = makeSession({ id: "b", startedAt: "2026-07-18T10:00:00.000Z" });
    const older = makeSession({ id: "a", startedAt: "2026-07-10T10:00:00.000Z" });
    const unrelated = makeSession({
      id: "c",
      startedAt: "2026-07-14T10:00:00.000Z",
      entries: [{ exercise: "Squat", sets: [makeSet()] }],
    });

    const result = exerciseSeries([newer, unrelated, older], "Bench Press");

    expect(result.map((p) => p.sessionId)).toEqual(["a", "b"]);
    expect(result[0]).toEqual({
      sessionId: "a",
      dayLabel: "Push",
      startedAt: "2026-07-10T10:00:00.000Z",
      sets: 1,
      reps: 8,
      volume: 80 * 8,
      oneRepMax: 101.3, // 80 × (1 + 8/30)
    });
  });

  it("sums duplicate entries for the exercise within a session", () => {
    // Mirrors the lastEntryForExercise regression: stored sessions may hold
    // several entries for the same exercise.
    const session = makeSession({
      entries: [
        { exercise: "Bench Press", sets: [makeSet({ weight: 80, reps: 8 })] },
        { exercise: "Bench Press", sets: [makeSet({ id: "set-2", weight: 100, reps: 5 })] },
      ],
    });

    const result = exerciseSeries([session], "Bench Press");

    expect(result).toHaveLength(1);
    expect(result[0].sets).toBe(2);
    expect(result[0].volume).toBe(80 * 8 + 100 * 5);
  });

  it("returns an empty series for an unlogged exercise", () => {
    expect(exerciseSeries([makeSession()], "Deadlift")).toEqual([]);
  });
});

describe("date-range filtering", () => {
  const july = [
    makeSession({ id: "a", dateKey: "2026-07-05" }),
    makeSession({ id: "b", dateKey: "2026-07-15" }),
    makeSession({ id: "c", dateKey: "2026-07-25" }),
  ];

  it("keeps sessions inside the inclusive bounds", () => {
    const result = filterSessionsByDateRange(july, "2026-07-05", "2026-07-15");

    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("treats a null bound as an open end", () => {
    expect(filterSessionsByDateRange(july, "2026-07-10", null).map((s) => s.id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterSessionsByDateRange(july, null, "2026-07-10").map((s) => s.id)).toEqual(["a"]);
  });

  it("returns the input array untouched with no bounds", () => {
    expect(filterSessionsByDateRange(july, null, null)).toBe(july);
  });

  it("yields an empty list for a range with no sessions", () => {
    expect(filterSessionsByDateRange(july, "2026-08-01", "2026-08-31")).toEqual([]);
  });

  it("accepts only YYYY-MM-DD date params", () => {
    expect(parseDateKeyParam("2026-07-20")).toBe("2026-07-20");
    expect(parseDateKeyParam("20/07/2026")).toBeNull();
    expect(parseDateKeyParam("2026-7-20")).toBeNull();
    expect(parseDateKeyParam("")).toBeNull();
    expect(parseDateKeyParam(null)).toBeNull();
  });

  it("round-trips a dateKey through a local Date", () => {
    for (const key of ["2026-07-19", "2026-01-01", "2026-12-31"]) {
      expect(dateToDateKey(dateKeyToDate(key))).toBe(key);
    }
  });

  it("formats a dateKey without a timezone shift", () => {
    expect(formatDateKey("2026-07-19")).toBe("Jul 19");
    expect(formatDateKey("2026-01-01")).toBe("Jan 1");
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
