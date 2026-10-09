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
import { type CatalogExercise, catalogByName } from "@/lib/catalog";
import {
  CUSTOM_PLANS_BACKUP_KEY,
  CUSTOM_PLANS_KEY,
  type CustomPlan,
  type CustomPlanId,
  MAX_CUSTOM_PLANS,
  copyPlan,
  createPlan,
  loadCustomPlans,
  newCustomId,
  parseCustomPlansBlob,
  saveCustomPlans,
} from "@/lib/custom-plans";
import {
  DEFAULT_PLAN_ID,
  PLAN_KEY,
  type PlanId,
  type WorkoutPlan,
  enrichCustomPlans,
  knownDays,
  parseStoredPlanId,
  planById,
  resolvePlanId,
} from "@/lib/plans";
import type { PlanDay, WorkoutDay } from "@/lib/workouts";

type PlansStorageWarning = "save-failed" | "data-recovered";

type PlanContextValue = {
  /** False during SSR and the first client render; gate preference-derived UI on it. */
  hydrated: boolean;
  planId: PlanId;
  /** The active plan — prescriptive: what can be logged, and the primary ordering. */
  plan: WorkoutPlan;
  /** Every plan's days, active plan first — descriptive: how to read history. */
  knownDays: WorkoutDay[];
  /** Shipped plans, then the user's custom plans, enriched from the catalogue. */
  plans: WorkoutPlan[];
  /** As stored, before enrichment — the planner edits these. */
  customPlans: CustomPlan[];
  catalog: CatalogExercise[];
  setPlanId: (id: PlanId) => void;
  /** A new empty plan, or a copy of `source`; null once MAX_CUSTOM_PLANS exist. */
  createCustomPlan: (source?: { name: string; days: PlanDay[] }) => CustomPlanId | null;
  updateCustomPlan: (id: CustomPlanId, edit: (plan: CustomPlan) => CustomPlan) => void;
  deleteCustomPlan: (id: CustomPlanId) => void;
  /** The apply step of a backup import; `change` gets the latest stored plans. */
  replaceCustomPlans: (change: (current: CustomPlan[]) => CustomPlan[]) => void;
  plansStorageWarning: PlansStorageWarning | null;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within <PlanProvider>");
  return ctx;
}

// The stored plans as another tab may have left them; the fallback covers blocked
// storage and an unreadable blob (which loadCustomPlans already preserved on mount).
function readLatestPlans(fallback: CustomPlan[]): CustomPlan[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CUSTOM_PLANS_KEY);
  } catch {
    return fallback;
  }
  const parsed = parseCustomPlansBlob(raw);
  return parsed.kind === "corrupt" ? fallback : parsed.plans;
}

function writePlanId(id: PlanId) {
  try {
    window.localStorage.setItem(PLAN_KEY, id);
  } catch {
    // Non-fatal: the plan still applies for this visit.
  }
}

// Owns the active plan and the custom plans after hydration; PLAN_INIT_SCRIPT did the
// pre-paint part. Other tabs, /settings and /planner all flow through here.
export function PlanProvider({
  plans: builtInPlans,
  catalog,
  children,
}: {
  plans: WorkoutPlan[];
  catalog: CatalogExercise[];
  children: ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [storedPlanId, setStoredPlanId] = useState<PlanId | null>(null);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [plansStorageWarning, setPlansStorageWarning] = useState<PlansStorageWarning | null>(null);
  // The plans last loaded from or written to storage.
  const lastSavedRef = useRef<CustomPlan[] | null>(null);
  const loggedSaveErrorRef = useRef(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(PLAN_KEY);
    } catch {
      // Storage inaccessible (blocked/private mode): stay on the default —
      // the plan still works, the choice just won't persist.
    }
    const loaded = loadCustomPlans();
    const parsedId = parseStoredPlanId(stored);
    // Both keys come from one synchronous read, so a dangling id is really gone.
    if (parsedId !== null && resolvePlanId(parsedId, loaded.plans) !== parsedId) {
      writePlanId(DEFAULT_PLAN_ID);
    }
    lastSavedRef.current = loaded.plans;
    setCustomPlans(loaded.plans);
    setStoredPlanId(parsedId);
    setHydrated(true);
    if (loaded.kind !== "ok") {
      const what =
        loaded.kind === "corrupt"
          ? "stored custom plans were unreadable"
          : `${loaded.dropped} stored custom plan(s) were invalid and dropped`;
      const backup = loaded.backedUp
        ? `original kept under "${CUSTOM_PLANS_BACKUP_KEY}"`
        : "backing the original up also failed";
      console.error(`Rep Track: ${what}; ${backup}`);
      setPlansStorageWarning("data-recovered");
    }

    // Another tab changed the active plan or the custom plans (or cleared
    // storage) — adopt it in memory only, never writing back from here.
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PLAN_KEY) {
        setStoredPlanId(parseStoredPlanId(e.key === null ? null : e.newValue));
      }
      if (e.key === null || e.key === CUSTOM_PLANS_KEY) {
        const external = parseCustomPlansBlob(e.key === null ? null : e.newValue).plans;
        lastSavedRef.current = external;
        setCustomPlans(external);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const planId = resolvePlanId(storedPlanId, customPlans);

  // Keeps <html data-plan> in sync; gated on hydrated so the initial default
  // never undoes what the init script applied before paint.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.plan = planId;
  }, [hydrated, planId]);

  const setPlanId = useCallback((next: PlanId) => {
    setStoredPlanId(next);
    writePlanId(next);
  }, []);

  // Read-modify-write against storage, not React state: another tab may have
  // saved since our last storage event, and its edits must not be overwritten.
  const commit = useCallback((change: (current: CustomPlan[]) => CustomPlan[]) => {
    const latest = readLatestPlans(lastSavedRef.current ?? []);
    const next = change(latest);
    if (next === latest) return;
    lastSavedRef.current = next;
    setCustomPlans(next);
    const result = saveCustomPlans(next);
    if (result.ok) {
      setPlansStorageWarning((prev) => (prev === "save-failed" ? null : prev));
      return;
    }
    if (!loggedSaveErrorRef.current) {
      loggedSaveErrorRef.current = true;
      console.error("Rep Track: could not persist custom plans", result.error);
    }
    setPlansStorageWarning("save-failed");
  }, []);

  const createCustomPlan = useCallback(
    (source?: { name: string; days: PlanDay[] }) => {
      const now = new Date().toISOString();
      const plan = source
        ? copyPlan(source, newCustomId, now)
        : createPlan("My plan", newCustomId, now);
      let created = false;
      commit((current) => {
        if (current.length >= MAX_CUSTOM_PLANS) return current;
        created = true;
        return [...current, plan];
      });
      return created ? plan.id : null;
    },
    [commit],
  );

  const updateCustomPlan = useCallback(
    (id: CustomPlanId, edit: (plan: CustomPlan) => CustomPlan) => {
      const now = new Date().toISOString();
      commit((current) => {
        const index = current.findIndex((plan) => plan.id === id);
        if (index === -1) return current;
        const edited = edit(current[index]);
        return edited === current[index]
          ? current
          : current.with(index, { ...edited, updatedAt: now });
      });
    },
    [commit],
  );

  // The plans blob is written before the active id, so another tab never sees a dangling id.
  const deleteCustomPlan = useCallback(
    (id: CustomPlanId) => {
      commit((current) => current.filter((plan) => plan.id !== id));
      if (id === planId) setPlanId(DEFAULT_PLAN_ID);
    },
    [commit, planId, setPlanId],
  );

  const replaceCustomPlans = useCallback(
    (change: (current: CustomPlan[]) => CustomPlan[]) => {
      let next: CustomPlan[] = [];
      commit((current) => {
        next = change(current);
        return next;
      });
      if (resolvePlanId(planId, next) !== planId) setPlanId(DEFAULT_PLAN_ID);
    },
    [commit, planId, setPlanId],
  );

  const catalogMap = useMemo(() => catalogByName(catalog), [catalog]);
  const plans = useMemo(
    () => [...builtInPlans, ...enrichCustomPlans(customPlans, catalogMap)],
    [builtInPlans, customPlans, catalogMap],
  );

  const value = useMemo(
    () => ({
      hydrated,
      planId,
      plan: planById(planId, plans),
      knownDays: knownDays(planId, plans),
      plans,
      customPlans,
      catalog,
      setPlanId,
      createCustomPlan,
      updateCustomPlan,
      deleteCustomPlan,
      replaceCustomPlans,
      plansStorageWarning,
    }),
    [
      hydrated,
      planId,
      plans,
      customPlans,
      catalog,
      setPlanId,
      createCustomPlan,
      updateCustomPlan,
      deleteCustomPlan,
      replaceCustomPlans,
      plansStorageWarning,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
