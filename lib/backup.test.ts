import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  mergeSessions,
  parseBackup,
  parseBackupFile,
  serializeBackup,
} from "./backup";
import type { CustomPlan } from "./custom-plans";
import type { Session } from "./sessions";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    dayId: "day-a",
    dayLabel: "Day A",
    dateKey: "2026-07-20",
    startedAt: "2026-07-20T10:00:00.000Z",
    entries: [{ exercise: "Bench Press", sets: [{ id: "set-1", reps: 8, weight: 80 }] }],
    ...overrides,
  };
}

function makePlan(overrides: Partial<CustomPlan> = {}): CustomPlan {
  return {
    id: "custom-00000000-0000-4000-8000-000000000100",
    name: "Mine",
    updatedAt: "2026-07-21T09:00:00.000Z",
    days: [
      {
        id: "custom-00000000-0000-4000-8000-000000000101",
        label: "Push",
        title: "Upper",
        focus: "Chest",
        exercises: [{ name: "Bench Press", sets: 3, reps: 8 }],
      },
    ],
    ...overrides,
  };
}

describe("serializeBackup / parseBackup round-trip", () => {
  it("restores the exact sessions it wrote", () => {
    const sessions = [makeSession(), makeSession({ id: "session-2", dateKey: "2026-07-22" })];

    const restored = parseBackup(serializeBackup(sessions, "2026-07-22T09:00:00.000Z"));

    expect(restored).toEqual({ kind: "ok", sessions });
  });

  it("writes a versioned envelope", () => {
    const envelope = JSON.parse(serializeBackup([makeSession()], "2026-07-22T09:00:00.000Z"));

    expect(envelope.format).toBe(BACKUP_FORMAT);
    expect(envelope.version).toBe(BACKUP_VERSION);
    expect(envelope.exportedAt).toBe("2026-07-22T09:00:00.000Z");
  });

  // Leakage guard: the exported file is the only thing that leaves the
  // browser, so it must carry exactly the session model — nothing else that
  // happens to live alongside it (other localStorage keys, UI state).
  it("exports exactly the envelope and session-model fields, nothing more", () => {
    const envelope = JSON.parse(serializeBackup([makeSession()], "2026-07-22T09:00:00.000Z"));

    expect(Object.keys(envelope).toSorted()).toEqual([
      "exportedAt",
      "format",
      "sessions",
      "version",
    ]);
    expect(Object.keys(envelope.sessions[0]).toSorted()).toEqual([
      "dateKey",
      "dayId",
      "dayLabel",
      "entries",
      "id",
      "startedAt",
    ]);
    expect(Object.keys(envelope.sessions[0].entries[0]).toSorted()).toEqual(["exercise", "sets"]);
    expect(Object.keys(envelope.sessions[0].entries[0].sets[0]).toSorted()).toEqual([
      "id",
      "reps",
      "weight",
    ]);
  });
});

describe("serializeBackup with custom plans", () => {
  it("writes version 2", () => {
    expect(BACKUP_VERSION).toBe(2);
  });

  it("adds the plans only when there are some", () => {
    const withPlans = JSON.parse(
      serializeBackup([makeSession()], "2026-07-22T09:00:00.000Z", [makePlan()]),
    );
    const withoutPlans = JSON.parse(
      serializeBackup([makeSession()], "2026-07-22T09:00:00.000Z", []),
    );

    expect(withPlans.plans).toEqual([makePlan()]);
    expect(Object.keys(withoutPlans)).not.toContain("plans");
  });
});

describe("parseBackupFile", () => {
  it("round-trips sessions and plans from a v2 file", () => {
    const sessions = [makeSession()];
    const plans = [makePlan()];

    const restored = parseBackupFile(serializeBackup(sessions, "2026-07-22T09:00:00.000Z", plans));

    expect(restored).toEqual({
      sessions: { kind: "ok", sessions },
      plans: { kind: "ok", plans },
    });
  });

  it("reports no plans for a v1 envelope or a bare sessions array", () => {
    const sessions = [makeSession()];
    const v1 = JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: "x", sessions });

    expect(parseBackupFile(v1)).toEqual({ sessions: { kind: "ok", sessions }, plans: null });
    expect(parseBackupFile(JSON.stringify(sessions)).plans).toBeNull();
  });

  it("restores the plans of a file with no sessions", () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 2,
      sessions: [],
      plans: [makePlan()],
    });

    expect(parseBackupFile(raw)).toEqual({
      sessions: { kind: "ok", sessions: [] },
      plans: { kind: "ok", plans: [makePlan()] },
    });
  });

  it("drops invalid plans individually while the sessions still parse", () => {
    const sessions = [makeSession()];
    const raw = JSON.stringify({
      sessions,
      plans: [makePlan(), makePlan({ name: "n".repeat(41) })],
    });

    expect(parseBackupFile(raw)).toEqual({
      sessions: { kind: "ok", sessions },
      plans: { kind: "partial", plans: [makePlan()], dropped: 1 },
    });
  });

  it("reports a plans value that is not an array as corrupt, keeping the sessions", () => {
    const sessions = [makeSession()];

    const result = parseBackupFile(JSON.stringify({ sessions, plans: { a: 1 } }));

    expect(result).toEqual({
      sessions: { kind: "ok", sessions },
      plans: { kind: "corrupt", plans: [] },
    });
  });

  it("reports unparseable JSON as corrupt sessions and no plans", () => {
    expect(parseBackupFile("{not json")).toEqual({
      sessions: { kind: "corrupt", sessions: [] },
      plans: null,
    });
  });
});

describe("parseBackup", () => {
  it("accepts a bare sessions array (raw localStorage dump)", () => {
    const sessions = [makeSession()];

    expect(parseBackup(JSON.stringify(sessions))).toEqual({ kind: "ok", sessions });
  });

  it("drops invalid sessions individually, keeping the rest", () => {
    const good = makeSession();
    const bad = { ...makeSession(), id: "" };

    const result = parseBackup(JSON.stringify({ sessions: [good, bad] }));

    expect(result).toEqual({ kind: "partial", sessions: [good], dropped: 1 });
  });

  it("reports unparseable JSON as corrupt", () => {
    expect(parseBackup("{not json")).toEqual({ kind: "corrupt", sessions: [] });
  });

  it("reports a payload with no sessions array as corrupt", () => {
    expect(parseBackup('{"format":"rep-track-backup"}')).toEqual({ kind: "corrupt", sessions: [] });
  });

  it("neutralizes prototype-pollution keys in an imported file", () => {
    // An imported file is arbitrary external data; hostile keys at either
    // level must neither survive validation nor touch Object.prototype.
    const raw =
      '{"format":"rep-track-backup","version":1,"__proto__":{"polluted":"yes"},' +
      '"sessions":[{"id":"s1","dayId":"d1","dayLabel":"Push","dateKey":"2026-07-20",' +
      '"startedAt":"2026-07-20T10:00:00.000Z","entries":[],"__proto__":{"polluted":"yes"}}]}';

    const result = parseBackup(raw);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.kind).toBe("ok");
    expect(result.sessions[0]).not.toHaveProperty("polluted");
    expect(Object.keys(result.sessions[0])).not.toContain("__proto__");
  });
});

describe("backupFilename", () => {
  it("dates the file by the local export day", () => {
    // Midday UTC keys to the same calendar day in every timezone this runs in.
    expect(backupFilename("2026-07-22T12:00:00.000Z")).toBe("rep-track-backup-2026-07-22.json");
  });
});

describe("mergeSessions", () => {
  it("unions by id, keeping sessions unique to each side", () => {
    const a = makeSession({ id: "a" });
    const b = makeSession({ id: "b", dateKey: "2026-07-22" });

    const merged = mergeSessions([a], [b]);

    expect(merged.map((s) => s.id).toSorted()).toEqual(["a", "b"]);
  });

  it("coalesces the same workout imported from another device into one session", () => {
    const local = makeSession({ id: "a" });
    const imported = makeSession({
      id: "b",
      startedAt: "2026-07-20T11:00:00.000Z",
      entries: [
        {
          exercise: "Bench Press",
          sets: [
            { id: "set-2", reps: 8, weight: 80 },
            { id: "set-3", reps: 8, weight: 80 },
            { id: "set-4", reps: 8, weight: 80 },
          ],
        },
      ],
    });

    const merged = mergeSessions([local], [imported]);

    expect(merged).toHaveLength(1);
    expect(merged[0].entries.flatMap((entry) => entry.sets)).toHaveLength(4);
  });

  it("lets the imported copy win an id collision", () => {
    const local = makeSession({ id: "x", dayLabel: "local" });
    const imported = makeSession({ id: "x", dayLabel: "imported" });

    const merged = mergeSessions([local], [imported]);

    expect(merged).toHaveLength(1);
    expect(merged[0].dayLabel).toBe("imported");
  });
});
