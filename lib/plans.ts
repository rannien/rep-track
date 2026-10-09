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
import type { CatalogExercise } from "./catalog";
import { CUSTOM_ID_PATTERN, type CustomPlan, type CustomPlanId, isCustomId } from "./custom-plans";
import {
  type Exercise,
  type PlanDay,
  type PlanExercise,
  type WorkoutDay,
  youtubeSearchUrl,
} from "./workouts";

export const PLAN_KEY = "rep-track-plan";

export type BuiltInPlanId = "barbell-strength" | "dumbbell-hybrid";
export type PlanId = BuiltInPlanId | CustomPlanId;

export type PlanDefinition = {
  id: BuiltInPlanId;
  name: string;
  summary: string;
  days: PlanDay[];
};

// A plan with every exercise enriched from the catalogue (see enrichPlans).
export type WorkoutPlan = Omit<PlanDefinition, "id" | "days"> & { id: PlanId; days: WorkoutDay[] };
export type BuiltInWorkoutPlan = WorkoutPlan & { id: BuiltInPlanId };

export const planDefinitions: PlanDefinition[] = [
  {
    id: "barbell-strength",
    name: "Barbell Strength",
    summary: "Heavy low-rep barbell compounds, then accessory work.",
    days: barbellStrengthDays,
  },
  {
    id: "dumbbell-hybrid",
    name: "Dumbbell Hybrid",
    summary: "Moderate-rep dumbbell and machine work.",
    days: dumbbellHybridDays,
  },
];

// The plan a device with no stored preference gets. Deliberately the barbell
// plan: it is the routine currently being run, and the dumbbell plan is one
// tap away in /settings.
export const DEFAULT_PLAN_ID: BuiltInPlanId = "barbell-strength";

// Syntactic, like PLAN_INIT_SCRIPT (resolvePlanId checks existence). An array lookup,
// never an object indexed by the raw string, so "__proto__" cannot resolve.
export function parseStoredPlanId(raw: string | null): PlanId | null {
  const builtIn = planDefinitions.find((plan) => plan.id === raw)?.id;
  if (builtIn !== undefined) return builtIn;
  return isCustomId(raw) ? raw : null;
}

export function resolvePlanId(
  parsed: PlanId | null,
  customPlans: Pick<CustomPlan, "id">[],
): PlanId {
  if (parsed === null) return DEFAULT_PLAN_ID;
  if (isCustomId(parsed) && !customPlans.some((plan) => plan.id === parsed)) {
    return DEFAULT_PLAN_ID;
  }
  return parsed;
}

export function planById(id: PlanId, plans: WorkoutPlan[]): WorkoutPlan {
  const plan = plans.find((candidate) => candidate.id === id);
  // PlanId is a closed union and lib/plans.test.ts asserts every member is in
  // `planDefinitions`, so this is unreachable — thrown rather than cast away.
  if (plan === undefined) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}

// Every plan's days, the active plan's first; day ids are unique across plans. A repeated
// label on a non-active day is qualified with its plan name for the legend and picker.
export function knownDays(activeId: PlanId, plans: WorkoutPlan[]): WorkoutDay[] {
  const labelCounts = new Map<string, number>();
  for (const day of plans.flatMap((plan) => plan.days)) {
    labelCounts.set(day.label, (labelCounts.get(day.label) ?? 0) + 1);
  }
  return [
    ...planById(activeId, plans).days,
    ...plans
      .filter((plan) => plan.id !== activeId)
      .flatMap((plan) =>
        plan.days.map((day) =>
          (labelCounts.get(day.label) ?? 0) > 1
            ? { ...day, label: `${plan.name} · ${day.label}` }
            : day,
        ),
      ),
  ];
}

// Runs as an inline <script> at the top of <body>, parser-blocking, so the
// active plan is the only one ever painted — /  server-renders every plan and
// a CSS attribute selector reveals one (see app/globals.css). Second
// deliberate pre-paint exception after THEME_INIT_SCRIPT; justified on the
// same grounds, that it decides primary content on first paint.
//
// Must stay semantically identical to parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID; a test
// executes this string. Anything else leaves the server-rendered default in place.
export const PLAN_INIT_SCRIPT = `(function () {
  try {
    var ids = ${JSON.stringify(planDefinitions.map((plan) => plan.id))};
    var custom = new RegExp(${JSON.stringify(CUSTOM_ID_PATTERN.source)});
    var stored = localStorage.getItem(${JSON.stringify(PLAN_KEY)});
    if (ids.indexOf(stored) !== -1 || (typeof stored === "string" && custom.test(stored))) {
      document.documentElement.setAttribute("data-plan", stored);
    }
  } catch (error) {}
})();`;

function fromCatalogEntry(exercise: PlanExercise, entry: CatalogExercise): Exercise {
  return {
    ...exercise,
    muscles: entry.muscleGroups,
    movement: entry.movementPattern,
    youtube: entry.videoUrl,
    detailUrl: entry.detailUrl,
  };
}

function enrichExercise(
  exercise: PlanExercise,
  catalogs: ReadonlyMap<string, CatalogExercise>[],
): Exercise {
  const entry = catalogs
    .map((catalog) => catalog.get(exercise.name))
    .find((found) => found !== undefined);
  if (entry === undefined)
    throw new Error(`No catalogue entry for plan exercise "${exercise.name}"`);
  return fromCatalogEntry(exercise, entry);
}

// Earlier catalogues win (live, then snapshot); lib/plans.test.ts keeps every plan
// exercise in the snapshot, so enrichExercise never throws in a release.
export function enrichPlans(
  definitions: PlanDefinition[],
  catalogs: ReadonlyMap<string, CatalogExercise>[],
): BuiltInWorkoutPlan[] {
  return definitions.map((plan) => ({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => enrichExercise(exercise, catalogs)),
    })),
  }));
}

// Unlike enrichExercise this never throws: a user's plan may name an exercise a later
// catalogue dropped, which then keeps its targets but loses muscles, movement and links.
function enrichCustomExercise(
  exercise: PlanExercise,
  catalog: ReadonlyMap<string, CatalogExercise>,
): Exercise {
  const entry = catalog.get(exercise.name);
  if (entry === undefined) {
    return { ...exercise, muscles: [], youtube: youtubeSearchUrl(exercise.name) };
  }
  return fromCatalogEntry(exercise, entry);
}

export function enrichCustomPlans(
  customs: CustomPlan[],
  catalog: ReadonlyMap<string, CatalogExercise>,
): WorkoutPlan[] {
  return customs.map((plan) => ({
    id: plan.id,
    name: plan.name.trim() || "Untitled plan",
    summary: "Your own plan, built in the planner.",
    days: plan.days.map((day, index) => ({
      ...day,
      label: day.label.trim() || `Day ${index + 1}`,
      title: day.title.trim() || "Untitled day",
      exercises: day.exercises.map((exercise) => enrichCustomExercise(exercise, catalog)),
    })),
  }));
}
