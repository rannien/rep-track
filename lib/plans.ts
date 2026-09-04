// Which plans ship, and which one is active. The plan data itself lives in
// lib/plan-*.ts and the plan *shape* in lib/workouts.ts; this module owns
// identity and the stored preference, the same split as lib/theme.ts and
// lib/units.ts (pure module + provider + settings component).
//
// Active plan vs. known days: the active plan is prescriptive — it decides
// what can be logged and the primary ordering. knownDays() is descriptive —
// the union of every shipped plan, active first, for interpreting history
// that was logged under whichever plan was active then. A plan the app still
// ships is not "off-plan", so switching must never demote its exercises to
// the OTHER_MUSCLE bucket.

import { barbellStrengthDays } from "./plan-barbell-strength";
import { dumbbellHybridDays } from "./plan-dumbbell-hybrid";
import type { WorkoutDay } from "./workouts";

export const PLAN_KEY = "rep-track-plan";

export type PlanId = "barbell-strength" | "dumbbell-hybrid";

export type WorkoutPlan = {
  id: PlanId;
  name: string;
  summary: string;
  days: WorkoutDay[];
};

export const plans: WorkoutPlan[] = [
  {
    id: "barbell-strength",
    name: "Barbell Strength",
    summary: "Heavy low-rep barbell compounds, then two accessories. Five lifts a day.",
    days: barbellStrengthDays,
  },
  {
    id: "dumbbell-hybrid",
    name: "Dumbbell Hybrid",
    summary: "Moderate-rep dumbbell and machine work. Six lifts a day.",
    days: dumbbellHybridDays,
  },
];

// The plan a device with no stored preference gets. Deliberately the barbell
// plan: it is the routine currently being run, and the dumbbell plan is one
// tap away in /settings.
export const DEFAULT_PLAN_ID: PlanId = "barbell-strength";

// localStorage is a trust boundary (see lib/sessions.ts): only an id this
// build actually ships is accepted; anything else yields null and the caller
// keeps DEFAULT_PLAN_ID. Deliberately a lookup over the array rather than an
// object keyed by the untrusted string — registry["__proto__"] returning
// Object.prototype is exactly the class of bug parseSessionsBlob guards
// against — and it returns the registry's own literal, so no cast is needed.
export function parseStoredPlanId(raw: string | null): PlanId | null {
  return plans.find((plan) => plan.id === raw)?.id ?? null;
}

export function planById(id: PlanId): WorkoutPlan {
  const plan = plans.find((candidate) => candidate.id === id);
  // PlanId is a closed union and lib/plans.test.ts asserts every member is in
  // `plans`, so this is unreachable — thrown rather than cast away.
  if (plan === undefined) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}

// Every shipped plan's days, the active plan's first. Day ids are globally
// unique across plans (asserted in lib/plans.test.ts), so this never contains
// a duplicate — two plans sharing a day id would merge their session
// histories, since a session keys on (dayId, dateKey) alone.
export function knownDays(activeId: PlanId): WorkoutDay[] {
  return [
    ...planById(activeId).days,
    ...plans.filter((plan) => plan.id !== activeId).flatMap((plan) => plan.days),
  ];
}

// Runs as an inline <script> at the top of <body>, parser-blocking, so the
// active plan is the only one ever painted — /  server-renders every plan and
// a CSS attribute selector reveals one (see app/globals.css). Second
// deliberate pre-paint exception after THEME_INIT_SCRIPT; justified on the
// same grounds, that it decides primary content on first paint.
//
// Unlike the theme script this only *overwrites* data-plan when the stored
// value is a shipped id, so an absent key, garbage, or blocked storage all
// leave the server-rendered DEFAULT_PLAN_ID in place. Must stay semantically
// identical to parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID — a test executes
// this string to enforce it. indexOf over an array literal keeps the
// prototype hazard out by construction, and the id list is interpolated from
// the registry so it cannot drift.
export const PLAN_INIT_SCRIPT = `(function () {
  try {
    var ids = ${JSON.stringify(plans.map((plan) => plan.id))};
    var stored = localStorage.getItem(${JSON.stringify(PLAN_KEY)});
    if (ids.indexOf(stored) !== -1) {
      document.documentElement.setAttribute("data-plan", stored);
    }
  } catch (error) {}
})();`;
