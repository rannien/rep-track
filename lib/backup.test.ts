import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  mergeSessions,
  parseBackup,
  serializeBackup,
} from "./backup";
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
    const b = makeSession({ id: "b" });

    const merged = mergeSessions([a], [b]);

    expect(merged.map((s) => s.id).toSorted()).toEqual(["a", "b"]);
  });

  it("lets the imported copy win an id collision", () => {
    const local = makeSession({ id: "x", dayLabel: "local" });
    const imported = makeSession({ id: "x", dayLabel: "imported" });

    const merged = mergeSessions([local], [imported]);

    expect(merged).toHaveLength(1);
    expect(merged[0].dayLabel).toBe("imported");
  });
});
