"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions } from "@/components/session-provider";
import { backupFilename, mergeSessions, parseBackup, serializeBackup } from "@/lib/backup";
import type { Session } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { CircleCheck, Download, ShieldCheck, TriangleAlert, Upload, X } from "lucide-react";

const LAST_BACKUP_KEY = "rep-track-last-backup";
// Nudge to export once this many days of logging have passed unbacked-up.
const BACKUP_REMINDER_DAYS = 14;

type Status = { kind: "success" | "error"; message: string };
type PendingImport = { sessions: Session[]; dropped: number };

// A file download without a backend: stringify → Blob → object URL → click.
function downloadJson(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// The latest session's timestamp, or null for an empty history.
function latestSessionAt(sessions: Session[]): string | null {
  let latest: string | null = null;
  for (const session of sessions) {
    if (latest === null || session.startedAt > latest) latest = session.startedAt;
  }
  return latest;
}

function droppedNote(dropped: number): string {
  return dropped > 0 ? ` (${dropped} invalid skipped)` : "";
}

// Export/import for the localStorage-only history — the user-facing safety net
// against silent eviction. Import validates and either merges (additive) or
// replaces (guarded by an inline confirm, since it overwrites the history).
export function DataControls() {
  const { hydrated, sessions, replaceAllSessions } = useSessions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  // Hydration-safe: the last-backup marker is localStorage-derived, so read it
  // on mount rather than during render.
  useEffect(() => {
    try {
      setLastBackup(window.localStorage.getItem(LAST_BACKUP_KEY));
    } catch {
      // Storage blocked (private mode) — the reminder simply won't show.
    }
  }, []);

  function markBackedUp(at: string) {
    setLastBackup(at);
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, at);
    } catch {
      // Non-fatal: the export still succeeded, only the reminder state is lost.
    }
  }

  function handleExport() {
    if (sessions.length === 0) return;
    const exportedAt = new Date().toISOString();
    downloadJson(backupFilename(exportedAt), serializeBackup(sessions, exportedAt));
    markBackedUp(exportedAt);
    setStatus({
      kind: "success",
      message: `Exported ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}.`,
    });
  }

  async function handleFile(file: File) {
    setStatus(null);
    setConfirmingReplace(false);
    const result = parseBackup(await file.text());
    if (result.sessions.length === 0) {
      setPending(null);
      setStatus({
        kind: "error",
        message:
          result.kind === "corrupt"
            ? "That file isn't a Rep Track backup, or it's damaged."
            : "No valid sessions found in that file.",
      });
      return;
    }
    setPending({
      sessions: result.sessions,
      dropped: result.kind === "partial" ? result.dropped : 0,
    });
  }

  function finishImport(next: Session[], importedCount: number, dropped: number) {
    replaceAllSessions(next);
    setPending(null);
    setConfirmingReplace(false);
    setStatus({
      kind: "success",
      message: `Imported ${importedCount} ${importedCount === 1 ? "session" : "sessions"}${droppedNote(dropped)}.`,
    });
  }

  function handleMerge() {
    if (!pending) return;
    finishImport(
      mergeSessions(sessions, pending.sessions),
      pending.sessions.length,
      pending.dropped,
    );
  }

  function handleReplace() {
    if (!pending) return;
    finishImport(pending.sessions, pending.sessions.length, pending.dropped);
  }

  function cancelImport() {
    setPending(null);
    setConfirmingReplace(false);
  }

  const hasData = hydrated && sessions.length > 0;
  const latest = hydrated ? latestSessionAt(sessions) : null;
  const showReminder =
    hasData &&
    latest !== null &&
    (lastBackup === null ||
      (latest > lastBackup &&
        Date.now() - Date.parse(lastBackup) > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-card-foreground">Backup &amp; restore</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your history lives only in this browser and can be cleared by the browser or by clearing
          site data. Export a copy to keep it safe, and import it on a new device or after a reset.
        </p>
      </div>

      {showReminder ? (
        <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-card-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          You&apos;ve logged new sessions since your last backup — export a fresh copy so you
          don&apos;t lose them.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
        >
          <Download className="size-4" aria-hidden="true" />
          Export backup
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!hydrated}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden="true" />
          Import backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so re-picking the same file fires change again.
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      {/* Import decision: additive merge, or a guarded destructive replace. */}
      {pending ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-xs">
          <p className="text-card-foreground">
            Found{" "}
            <span className="font-semibold">
              {pending.sessions.length} {pending.sessions.length === 1 ? "session" : "sessions"}
            </span>
            {droppedNote(pending.dropped)} in that backup. You currently have {sessions.length}.
          </p>
          {confirmingReplace ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-start gap-2 font-medium text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Replace all {sessions.length} current{" "}
                {sessions.length === 1 ? "session" : "sessions"} with the {pending.sessions.length}{" "}
                from the backup? This can&apos;t be undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReplace}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 font-semibold text-destructive-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  Replace all
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReplace(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMerge}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Upload className="size-3.5" aria-hidden="true" />
                Add to my history
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReplace(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Replace everything
              </button>
              <button
                type="button"
                onClick={cancelImport}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Import/export outcome — announced for screen readers. */}
      <p aria-live="polite">
        {status ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              status.kind === "success" ? "text-primary" : "text-destructive",
            )}
          >
            {status.kind === "success" ? (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <TriangleAlert className="size-3.5" aria-hidden="true" />
            )}
            {status.message}
          </span>
        ) : null}
      </p>
    </section>
  );
}
