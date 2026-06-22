"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type LoggedSet, type Session, loadSessions, saveSessions, todayKey } from "@/lib/sessions";

type DayRef = { id: string; label: string };

type SessionContextValue = {
  /** False during SSR and the first client render; gate localStorage-derived UI on it. */
  hydrated: boolean;
  sessions: Session[];
  /** Today's session for a given workout day, if one has been started. */
  todaySession: (dayId: string) => Session | undefined;
  /** Append a set to today's session, creating the session/entry as needed. */
  addSet: (day: DayRef, exercise: string, set: { reps: number; weight: number }) => void;
  removeSet: (sessionId: string, exercise: string, setId: string) => void;
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

  // Same hydration-safe pattern as the rest of the app: read on mount, write
  // only after hydration so we never touch `window` during SSR.
  useEffect(() => {
    setSessions(loadSessions());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSessions(sessions);
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
        // Deep-clone the touched session so React sees a new reference.
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
    () => ({ hydrated, sessions, todaySession, addSet, removeSet }),
    [hydrated, sessions, todaySession, addSet, removeSet],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
