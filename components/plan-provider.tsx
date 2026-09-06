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
import {
  DEFAULT_PLAN_ID,
  PLAN_KEY,
  type PlanId,
  type WorkoutPlan,
  knownDays,
  parseStoredPlanId,
  planById,
} from "@/lib/plans";
import type { WorkoutDay } from "@/lib/workouts";

type PlanContextValue = {
  /** False during SSR and the first client render; gate preference-derived UI on it. */
  hydrated: boolean;
  planId: PlanId;
  /** The active plan — prescriptive: what can be logged, and the primary ordering. */
  plan: WorkoutPlan;
  /** Every shipped plan's days, active plan first — descriptive: how to read history. */
  knownDays: WorkoutDay[];
  setPlanId: (id: PlanId) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within <PlanProvider>");
  return ctx;
}

// Owns the active-plan preference after hydration. The pre-paint work is done
// by PLAN_INIT_SCRIPT in the layout; this provider re-derives the same answer
// on mount and then keeps it live: other tabs and the settings page flow
// through here.
export function PlanProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [planId, setPlanIdState] = useState<PlanId>(DEFAULT_PLAN_ID);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(PLAN_KEY);
    } catch {
      // Storage inaccessible (blocked/private mode): stay on the default —
      // the plan still works, the choice just won't persist.
    }
    setPlanIdState(parseStoredPlanId(stored) ?? DEFAULT_PLAN_ID);
    setHydrated(true);

    // Another tab switched plans (or cleared storage) — adopt it. No echo
    // guard needed: writes only happen in setPlanId, a user action.
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== PLAN_KEY) return; // null key = storage.clear()
      setPlanIdState(parseStoredPlanId(e.key === null ? null : e.newValue) ?? DEFAULT_PLAN_ID);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Keeps <html data-plan> in sync, so a switch on /settings reveals the
  // right plan on an already-mounted plan page. Gated on hydrated so the
  // initial default can never undo what the init script applied before paint.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.plan = planId;
  }, [hydrated, planId]);

  const setPlanId = useCallback((next: PlanId) => {
    setPlanIdState(next);
    try {
      window.localStorage.setItem(PLAN_KEY, next);
    } catch {
      // Non-fatal: the plan still applies for this visit.
    }
  }, []);

  // Memoized so the four consumers don't each rebuild the day list.
  const value = useMemo(
    () => ({
      hydrated,
      planId,
      plan: planById(planId),
      knownDays: knownDays(planId),
      setPlanId,
    }),
    [hydrated, planId, setPlanId],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
