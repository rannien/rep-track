"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TriangleAlert } from "lucide-react";
import { UndoToast } from "@/components/undo-toast";
import {
  SESSIONS_BACKUP_KEY,
  SESSIONS_KEY,
  type LoggedSet,
  type Session,
  type SetRemoval,
  addSetToSessions,
  backdatedSessionStart,
  loadSessions,
  parseSessionsBlob,
  removeSessionWithUndo,
  removeSetWithUndo,
  restoreRemovedSet,
  saveSessions,
  todayKey,
  updateSetInSessions,
} from "@/lib/sessions";

type DayRef = { id: string; label: string };

type StorageWarning = "save-failed" | "data-recovered";

type SessionContextValue = {
  /** False during SSR and the first client render; gate localStorage-derived UI on it. */
  hydrated: boolean;
  sessions: Session[];
  /** Today's session for a given workout day, if one has been started. */
  todaySession: (dayId: string) => Session | undefined;
  /** The session for a given workout day on a given calendar date, if any. */
  sessionOn: (dayId: string, dateKey: string) => Session | undefined;
  /**
   * Append a set to the day's session, creating the session/entry as needed.
   * dateKey targets a past calendar date (backfilling); default is today.
   */
  addSet: (
    day: DayRef,
    exercise: string,
    set: { reps: number; weight: number },
    dateKey?: string,
  ) => void;
  /** Delete a set. Undoable for a few seconds via the provider's toast. */
  removeSet: (sessionId: string, exercise: string, setId: string) => void;
  /** Delete a whole session; one Undo brings every set back. */
  removeSession: (sessionId: string) => void;
  /** Correct a logged set's reps/weight in place. */
  updateSet: (
    sessionId: string,
    exercise: string,
    setId: string,
    values: { reps: number; weight: number },
  ) => void;
  /** Overwrite the whole history — the apply step of a backup import. */
  replaceAllSessions: (sessions: Session[]) => void;
  /** Set while persistence is degraded; drives the storage banner. */
  storageWarning: StorageWarning | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessions(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessions must be used within <SessionProvider>");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState<StorageWarning | null>(null);
  // Deletions waiting for their undo window to expire. A stack: rapid deletes
  // accumulate and one Undo restores them all (newest first). Kept across
  // storage events — restoring is self-healing and duplicate-safe, and an
  // explicit Undo tap outranks whatever another tab did meanwhile.
  const [pendingRemovals, setPendingRemovals] = useState<SetRemoval[]>([]);
  // The last array loaded from or written to localStorage. Saving only when
  // state diverges from it keeps mount loads, storage events, and StrictMode
  // re-runs from being echoed back — in particular, a corrupt load can never
  // be overwritten with the empty fallback before the user logs something.
  const lastSavedRef = useRef<Session[] | null>(null);
  const loggedSaveErrorRef = useRef(false);

  // Same hydration-safe pattern as the rest of the app: read on mount, write
  // only after hydration so we never touch `window` during SSR.
  useEffect(() => {
    // Ask the browser to exempt our data from best-effort eviction (Safari's
    // tracking prevention deletes script storage after 7 idle days; others
    // evict LRU under pressure). Best-effort itself — a denial or missing API
    // needs no user action, since export/import is the real safety net.
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    const result = loadSessions();
    lastSavedRef.current = result.sessions;
    setSessions(result.sessions);
    setHydrated(true);
    if (result.kind !== "ok") {
      const what =
        result.kind === "corrupt"
          ? "stored sessions were unreadable"
          : `${result.dropped} stored session(s) were invalid and dropped`;
      const backup = result.backedUp
        ? `original kept under "${SESSIONS_BACKUP_KEY}"`
        : "backing the original up also failed";
      console.error(`Rep Track: ${what}; ${backup}`);
      setStorageWarning("data-recovered");
    }

    // Another tab wrote (or cleared) the sessions key — adopt its state.
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== SESSIONS_KEY) return; // null key = storage.clear()
      const external = parseSessionsBlob(e.key === null ? null : e.newValue);
      lastSavedRef.current = external.sessions;
      setSessions(external.sessions);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated || sessions === lastSavedRef.current) return;
    lastSavedRef.current = sessions;
    const result = saveSessions(sessions);
    if (result.ok) {
      setStorageWarning((prev) => (prev === "save-failed" ? null : prev));
      return;
    }
    // Log the raw error once; the banner keeps warning until a save succeeds.
    if (!loggedSaveErrorRef.current) {
      loggedSaveErrorRef.current = true;
      console.error("Rep Track: could not persist sessions", result.error);
    }
    setStorageWarning("save-failed");
  }, [sessions, hydrated]);

  const sessionOn = useCallback(
    (dayId: string, dateKey: string) =>
      sessions.find((s) => s.dayId === dayId && s.dateKey === dateKey),
    [sessions],
  );

  const todaySession = useCallback((dayId: string) => sessionOn(dayId, todayKey()), [sessionOn]);

  const addSet = useCallback(
    (day: DayRef, exercise: string, set: { reps: number; weight: number }, dateKey?: string) => {
      const newSet: LoggedSet = {
        id: crypto.randomUUID(),
        reps: set.reps,
        weight: set.weight,
      };
      const key = dateKey ?? todayKey();
      // The session identity is only used if the day's session doesn't exist
      // yet; addSetToSessions ignores it otherwise. A backfilled session gets
      // a synthetic noon start so it orders sanely among real timestamps.
      const target = {
        id: crypto.randomUUID(),
        dayId: day.id,
        dayLabel: day.label,
        dateKey: key,
        startedAt: key === todayKey() ? new Date().toISOString() : backdatedSessionStart(key),
      };
      setSessions((prev) => addSetToSessions(prev, target, exercise, newSet));
    },
    [],
  );

  // The apply step of a backup import; the caller has already validated and
  // (for a merge) combined the sessions. Replacing the array diverges it from
  // lastSavedRef, so the save effect persists it like any other mutation.
  const replaceAllSessions = useCallback((next: Session[]) => {
    setSessions(next);
  }, []);

  // Computed outside the state updater — capturing the removal is a side
  // effect, and updaters re-run under StrictMode. Depending on `sessions` is
  // free: the memoized context value changes with every sessions change anyway.
  const removeSet = useCallback(
    (sessionId: string, exercise: string, setId: string) => {
      const { sessions: next, removed } = removeSetWithUndo(sessions, sessionId, exercise, setId);
      if (!removed) return;
      setSessions(next);
      setPendingRemovals((prev) => [...prev, removed]);
    },
    [sessions],
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      const { sessions: next, removed } = removeSessionWithUndo(sessions, sessionId);
      if (removed.length === 0) return;
      setSessions(next);
      setPendingRemovals((prev) => [...prev, ...removed]);
    },
    [sessions],
  );

  const updateSet = useCallback(
    (
      sessionId: string,
      exercise: string,
      setId: string,
      values: { reps: number; weight: number },
    ) => {
      setSessions((prev) => updateSetInSessions(prev, sessionId, exercise, setId, values));
    },
    [],
  );

  const undoRemovals = useCallback(() => {
    setSessions((prev) => pendingRemovals.reduceRight(restoreRemovedSet, prev));
    setPendingRemovals([]);
  }, [pendingRemovals]);

  const clearRemovals = useCallback(() => setPendingRemovals([]), []);

  const value = useMemo(
    () => ({
      hydrated,
      sessions,
      todaySession,
      sessionOn,
      addSet,
      removeSet,
      removeSession,
      updateSet,
      replaceAllSessions,
      storageWarning,
    }),
    [
      hydrated,
      sessions,
      todaySession,
      sessionOn,
      addSet,
      removeSet,
      removeSession,
      updateSet,
      replaceAllSessions,
      storageWarning,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      {pendingRemovals.length > 0 ? (
        <UndoToast removals={pendingRemovals} onUndo={undoRemovals} onExpire={clearRemovals} />
      ) : null}
      {storageWarning ? (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-destructive/40 bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          <span className="mx-auto flex max-w-3xl items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            {storageWarning === "save-failed"
              ? "Your sets can't be saved — browser storage is full or unavailable. Changes may be lost when you close this page."
              : "Some saved history couldn't be read and was skipped. Everything else was recovered."}
          </span>
        </div>
      ) : null}
    </SessionContext.Provider>
  );
}
