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
import { DEFAULT_UNIT, UNIT_KEY, type WeightUnit, parseStoredUnit } from "@/lib/units";

type UnitContextValue = {
  /** False during SSR and the first client render; gate preference-derived UI on it. */
  hydrated: boolean;
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => void;
};

const UnitContext = createContext<UnitContextValue | null>(null);

export function useUnit(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useUnit must be used within <UnitProvider>");
  return ctx;
}

// Owns the kg/lb display preference — same shape as ThemeProvider: read on
// mount with a validated parser, write only on the user's action, adopt other
// tabs' writes via the storage event.
export function UnitProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [unit, setUnitState] = useState<WeightUnit>(DEFAULT_UNIT);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(UNIT_KEY);
    } catch {
      // Storage inaccessible (blocked/private mode): stay on kg — the
      // preference just won't persist.
    }
    setUnitState(parseStoredUnit(stored) ?? DEFAULT_UNIT);
    setHydrated(true);

    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== UNIT_KEY) return; // null key = storage.clear()
      setUnitState(parseStoredUnit(e.key === null ? null : e.newValue) ?? DEFAULT_UNIT);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setUnit = useCallback((next: WeightUnit) => {
    setUnitState(next);
    try {
      window.localStorage.setItem(UNIT_KEY, next);
    } catch {
      // Non-fatal: the unit still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ hydrated, unit, setUnit }), [hydrated, unit, setUnit]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}
