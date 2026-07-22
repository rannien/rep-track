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
import {
  SESSIONS_BACKUP_KEY,
  SESSIONS_KEY,
  type LoggedSet,
  type Session,
  loadSessions,
  parseSessionsBlob,
  saveSessions,
  todayKey,
} from "@/lib/sessions";

type DayRef = { id: string; label: string };

type StorageWarning = "save-failed" | "data-recovered";

type SessionContextValue = {
  /** False during SSR and the first client render; gate localStorage-derived UI on it. */
  hydrated: boolean;
  sessions: Session[];
  /** Today's session for a given workout day, if one has been started. */
  todaySession: (dayId: string) => Session | undefined;
  /** Append a set to today's session, creating the session/entry as needed. */
  addSet: (day: DayRef, exercise: string, set: { reps: number; weight: number }) => void;
  removeSet: (sessionId: string, exercise: string, setId: string) => void;
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
  // The last array loaded from or written to localStorage. Saving only when
  // state diverges from it keeps mount loads, storage events, and StrictMode
  // re-runs from being echoed back — in particular, a corrupt load can never
  // be overwritten with the empty fallback before the user logs something.
  const lastSavedRef = useRef<Session[] | null>(null);
  const loggedSaveErrorRef = useRef(false);

  // Same hydration-safe pattern as the rest of the app: read on mount, write
  // only after hydration so we never touch `window` during SSR.
  useEffect(() => {
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

  const todaySession = useCallback(
    (dayId: string) => {
      const key = todayKey();
      return sessions.find((s) => s.dayId === dayId && s.dateKey === key);
    },
    [sessions],
  );

  const addSet = useCallback(
    (day: DayRef, exercise: string, set: { reps: number; weight: number }) => {
      const key = todayKey();
      const newSet: LoggedSet = {
        id: crypto.randomUUID(),
        reps: set.reps,
        weight: set.weight,
      };
      setSessions((prev) => {
        // Shallow-copy the touched session and its entries array so React
        // sees new references along the changed path.
        const next = prev.slice();
        let idx = next.findIndex((s) => s.dayId === day.id && s.dateKey === key);
        let session: Session;
        if (idx === -1) {
          session = {
            id: crypto.randomUUID(),
            dayId: day.id,
            dayLabel: day.label,
            dateKey: key,
            startedAt: new Date().toISOString(),
            entries: [],
          };
          next.push(session);
        } else {
          session = { ...next[idx], entries: next[idx].entries.slice() };
          next[idx] = session;
        }
        const entryIdx = session.entries.findIndex((e) => e.exercise === exercise);
        if (entryIdx === -1) {
          session.entries.push({ exercise, sets: [newSet] });
        } else {
          session.entries[entryIdx] = {
            ...session.entries[entryIdx],
            sets: [...session.entries[entryIdx].sets, newSet],
          };
        }
        return next;
      });
    },
    [],
  );

  const removeSet = useCallback((sessionId: string, exercise: string, setId: string) => {
    setSessions((prev) =>
      prev
        .map((s) => {
          if (s.id !== sessionId) return s;
          const entries = s.entries
            .map((e) =>
              e.exercise === exercise
                ? { ...e, sets: e.sets.filter((set) => set.id !== setId) }
                : e,
            )
            .filter((e) => e.sets.length > 0);
          return { ...s, entries };
        })
        // Drop sessions that no longer hold any sets.
        .filter((s) => s.entries.length > 0),
    );
  }, []);

  const value = useMemo(
    () => ({ hydrated, sessions, todaySession, addSet, removeSet, storageWarning }),
    [hydrated, sessions, todaySession, addSet, removeSet, storageWarning],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
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
