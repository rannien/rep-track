// Backup export/import for the localStorage-only history. localStorage is a
// best-effort store the browser may evict under pressure — and Safari's
// tracking prevention deletes it after seven idle days — so a downloadable
// JSON copy is the real safety net. Import reuses parseSessionsArray so a
// restored file passes the exact same trust-boundary validation as a normal
// load; a merge unions by session id (see mergeSessions).

import { type ParsedSessions, type Session, parseSessionsArray } from "./sessions";

export const BACKUP_FORMAT = "rep-track-backup";
export const BACKUP_VERSION = 1;

// The envelope written to disk. Versioned so a future format change can be
// detected; `exportedAt` records when the copy was taken.
export type BackupEnvelope = {
  format: string;
  version: number;
  exportedAt: string; // ISO timestamp
  sessions: Session[];
};

// Pretty-printed so a curious user can read the file; the caller supplies the
// timestamp (keeps this pure and testable, and follows "no Date.now() buried
// in logic").
export function serializeBackup(sessions: Session[], exportedAt: string): string {
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    sessions,
  };
  return JSON.stringify(envelope, null, 2);
}

// rep-track-backup-YYYY-MM-DD.json, dated by the local calendar day the export
// was taken (same en-CA convention as todayKey).
export function backupFilename(exportedAt: string): string {
  const day = new Date(exportedAt).toLocaleDateString("en-CA");
  return `${BACKUP_FORMAT}-${day}.json`;
}

function hasSessionsArray(value: unknown): value is { sessions: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { sessions?: unknown }).sessions)
  );
}

// Validate a backup file's contents. Accepts our envelope ({ sessions: [...] })
// or a bare sessions array (e.g. a raw localStorage dump), then runs the array
// through the shared session validator — invalid sessions drop individually.
export function parseBackup(raw: string): ParsedSessions {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupt", sessions: [] };
  }
  const candidate = hasSessionsArray(parsed) ? parsed.sessions : parsed;
  return parseSessionsArray(candidate);
}

// Union two session lists by id; the imported copy wins an id collision so a
// restore reflects the backup. Order is irrelevant — every view sorts by
// startedAt — so existing sessions keep their slots and new ones append.
export function mergeSessions(existing: Session[], imported: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const session of existing) byId.set(session.id, session);
  for (const session of imported) byId.set(session.id, session);
  return [...byId.values()];
}
