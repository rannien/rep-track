"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { todayKey } from "@/lib/sessions";

type LoggingDateContextValue = {
  /** The calendar date (dateKey) the day's logging UI writes to — today unless overridden. */
  dateFor: (dayId: string) => string;
  isBackdated: (dayId: string) => boolean;
  /** Point a day's logging at a past date; null returns it to today. */
  setDateFor: (dayId: string, dateKey: string | null) => void;
};

const LoggingDateContext = createContext<LoggingDateContextValue | null>(null);

export function useLoggingDate(): LoggingDateContextValue {
  const ctx = useContext(LoggingDateContext);
  if (!ctx) throw new Error("useLoggingDate must be used within <LoggingDateProvider>");
  return ctx;
}

// Per-day choice of which calendar date the logging UI writes to, so a missed
// workout can be backfilled. Pure view state: never persisted, every visit
// starts on today.
export function LoggingDateProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, string>>(new Map());

  const setDateFor = useCallback((dayId: string, dateKey: string | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      // Picking today is the same as clearing — "backdated to today" is not a state.
      if (dateKey === null || dateKey === todayKey()) {
        next.delete(dayId);
      } else {
        next.set(dayId, dateKey);
      }
      return next;
    });
  }, []);

  const dateFor = useCallback((dayId: string) => overrides.get(dayId) ?? todayKey(), [overrides]);

  const isBackdated = useCallback((dayId: string) => overrides.has(dayId), [overrides]);

  const value = useMemo(
    () => ({ dateFor, isBackdated, setDateFor }),
    [dateFor, isBackdated, setDateFor],
  );

  return <LoggingDateContext.Provider value={value}>{children}</LoggingDateContext.Provider>;
}
