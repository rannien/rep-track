// User-built plans, stored per device; names/sets/reps only, enriched from the catalogue
// in lib/plans.ts. React layer: components/plan-provider.tsx.

import { MAX_REPS } from "./sessions";
import type { PlanDay, PlanExercise } from "./workouts";

export type CustomPlanId = `custom-${string}`;

export type CustomPlan = {
  id: CustomPlanId;
  name: string;
  updatedAt: string; // ISO timestamp of the last edit; decides backup merges
  days: PlanDay[];
};

export const CUSTOM_PLANS_KEY = "rep-track-custom-plans-v1";
export const CUSTOM_PLANS_BACKUP_KEY = "rep-track-custom-plans-v1-corrupt";

export const MAX_CUSTOM_PLANS = 10;
export const MAX_PLAN_DAYS = 7;
export const MAX_DAY_EXERCISES = 15;
export const MAX_PLAN_NAME_LENGTH = 40;
export const MAX_DAY_LABEL_LENGTH = 12;
export const MAX_DAY_TITLE_LENGTH = 40;
export const MAX_DAY_FOCUS_LENGTH = 60;
export const MAX_EXERCISE_NAME_LENGTH = 100;
export const MAX_SETS = 10;
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;

// Plan and day ids: the prefix keeps them disjoint from shipped ids; the strict UUID keeps
// CSS/HTML-significant characters out of <html data-plan>, which PLAN_INIT_SCRIPT writes.
export const CUSTOM_ID_PATTERN =
  /^custom-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCustomId(value: unknown): value is CustomPlanId {
  return typeof value === "string" && CUSTOM_ID_PATTERN.test(value);
}

export function newCustomId(): CustomPlanId {
  return `custom-${crypto.randomUUID()}`;
}

// localStorage and backup files are trust boundaries. Own properties only, so
// a "__proto__" or "constructor" key can never resolve to Object.prototype.
function ownValue(record: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function isRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseExercise(value: unknown): PlanExercise | null {
  if (!isRecord(value)) return null;
  const name = ownValue(value, "name");
  const sets = ownValue(value, "sets");
  const reps = ownValue(value, "reps");
  if (!isBoundedString(name, MAX_EXERCISE_NAME_LENGTH) || name.trim() === "") return null;
  if (!isIntegerInRange(sets, 1, MAX_SETS) || !isIntegerInRange(reps, 1, MAX_REPS)) return null;
  return { name, sets, reps };
}

// Draft states are valid: a day may be empty and its texts blank while the
// user is still building it (see isUsable for what activation requires).
function parseDay(value: unknown): PlanDay | null {
  if (!isRecord(value)) return null;
  const id = ownValue(value, "id");
  const label = ownValue(value, "label");
  const title = ownValue(value, "title");
  const focus = ownValue(value, "focus");
  const exercises = ownValue(value, "exercises");
  if (!isCustomId(id)) return null;
  if (!isBoundedString(label, MAX_DAY_LABEL_LENGTH)) return null;
  if (!isBoundedString(title, MAX_DAY_TITLE_LENGTH)) return null;
  if (!isBoundedString(focus, MAX_DAY_FOCUS_LENGTH)) return null;
  if (!Array.isArray(exercises) || exercises.length > MAX_DAY_EXERCISES) return null;
  const parsed: PlanExercise[] = [];
  for (const exercise of exercises) {
    const entry = parseExercise(exercise);
    // Exercise names key the logging UI within a day, so a repeat is invalid.
    if (!entry || parsed.some((existing) => existing.name === entry.name)) return null;
    parsed.push(entry);
  }
  return { id, label, title, focus, exercises: parsed };
}

// toISOString() output; a bare local datetime would make merge ordering timezone-dependent.
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function parsePlan(value: unknown): CustomPlan | null {
  if (!isRecord(value)) return null;
  const id = ownValue(value, "id");
  const name = ownValue(value, "name");
  const updatedAt = ownValue(value, "updatedAt");
  const days = ownValue(value, "days");
  if (!isCustomId(id) || !isBoundedString(name, MAX_PLAN_NAME_LENGTH)) return null;
  if (typeof updatedAt !== "string" || !UTC_TIMESTAMP_PATTERN.test(updatedAt)) return null;
  if (!Array.isArray(days) || days.length > MAX_PLAN_DAYS) return null;
  const parsed: PlanDay[] = [];
  for (const day of days) {
    const entry = parseDay(day);
    // One bad day invalidates the plan — never keep a silently altered plan.
    if (!entry) return null;
    parsed.push(entry);
  }
  return { id, name, updatedAt, days: parsed };
}

export type ParsedCustomPlans =
  | { kind: "ok"; plans: CustomPlan[] }
  | { kind: "partial"; plans: CustomPlan[]; dropped: number }
  | { kind: "corrupt"; plans: CustomPlan[] }; // plans is always [] here

function dayIds(plan: CustomPlan): string[] {
  return plan.days.map((day) => day.id);
}

// Invalid plans drop individually. Ids are unique across all plans (a shared day id would
// merge two session histories); the first claimant wins.
export function parseCustomPlansArray(value: unknown): ParsedCustomPlans {
  if (!Array.isArray(value)) return { kind: "corrupt", plans: [] };
  const plans: CustomPlan[] = [];
  const seenIds = new Set<string>();
  for (const candidate of value) {
    if (plans.length === MAX_CUSTOM_PLANS) break;
    const plan = parsePlan(candidate);
    if (!plan) continue;
    const ids = [plan.id, ...dayIds(plan)];
    if (new Set(ids).size !== ids.length || ids.some((id) => seenIds.has(id))) continue;
    for (const id of ids) seenIds.add(id);
    plans.push(plan);
  }
  const dropped = value.length - plans.length;
  return dropped > 0 ? { kind: "partial", plans, dropped } : { kind: "ok", plans };
}

export function parseCustomPlansBlob(raw: string | null): ParsedCustomPlans {
  if (raw === null || raw === "") return { kind: "ok", plans: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupt", plans: [] };
  }
  return parseCustomPlansArray(parsed);
}

export type LoadCustomPlansResult = ParsedCustomPlans & { backedUp: boolean };

// Mirrors loadSessions: a rejected payload is copied aside before anything can
// overwrite it with the salvaged state.
export function loadCustomPlans(): LoadCustomPlansResult {
  if (typeof window === "undefined") return { kind: "ok", plans: [], backedUp: false };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CUSTOM_PLANS_KEY);
  } catch {
    return { kind: "ok", plans: [], backedUp: false };
  }
  const result = parseCustomPlansBlob(raw);
  if (result.kind === "ok" || raw === null) return { ...result, backedUp: false };
  let backedUp = false;
  try {
    window.localStorage.setItem(CUSTOM_PLANS_BACKUP_KEY, raw);
    backedUp = true;
  } catch {
    // Best effort — a quota error here must not block loading what survived.
  }
  return { ...result, backedUp };
}

export type SaveCustomPlansResult = { ok: true } | { ok: false; error: unknown };

export function saveCustomPlans(plans: CustomPlan[]): SaveCustomPlansResult {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(CUSTOM_PLANS_KEY, JSON.stringify(plans));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

// A plan can be activated once every day has something to log.
export function isUsable(plan: { days: { exercises: unknown[] }[] }): boolean {
  return plan.days.length > 0 && plan.days.every((day) => day.exercises.length > 0);
}

function nextDayLabel(days: PlanDay[]): string {
  const used = new Set(days.map((day) => day.label));
  for (let index = 0; index < MAX_PLAN_DAYS; index++) {
    const label = `Day ${String.fromCharCode(65 + index)}`;
    if (!used.has(label)) return label;
  }
  return "";
}

function emptyDay(id: CustomPlanId, days: PlanDay[]): PlanDay {
  return { id, label: nextDayLabel(days), title: "", focus: "", exercises: [] };
}

// Editing ops return the same reference on a no-op (cap reached, unknown id) so callers can
// detect it; the caller stamps updatedAt.

export function createPlan(name: string, newId: () => CustomPlanId, now: string): CustomPlan {
  return {
    id: newId(),
    name: name.slice(0, MAX_PLAN_NAME_LENGTH),
    updatedAt: now,
    days: [emptyDay(newId(), [])],
  };
}

// Fresh plan and day ids: reusing the source's day ids would merge this plan's
// history into the shipped plan's.
export function copyPlan(
  source: { name: string; days: PlanDay[] },
  newId: () => CustomPlanId,
  now: string,
): CustomPlan {
  return {
    id: newId(),
    name: `${source.name} (copy)`.slice(0, MAX_PLAN_NAME_LENGTH),
    updatedAt: now,
    days: source.days.slice(0, MAX_PLAN_DAYS).map((day) => ({
      id: newId(),
      label: day.label.slice(0, MAX_DAY_LABEL_LENGTH),
      title: day.title.slice(0, MAX_DAY_TITLE_LENGTH),
      focus: day.focus.slice(0, MAX_DAY_FOCUS_LENGTH),
      exercises: day.exercises
        .slice(0, MAX_DAY_EXERCISES)
        .map(({ name, sets, reps }) => ({ name, sets, reps })),
    })),
  };
}

export function renamePlan(plan: CustomPlan, name: string): CustomPlan {
  return { ...plan, name: name.slice(0, MAX_PLAN_NAME_LENGTH) };
}

export function addDay(plan: CustomPlan, id: CustomPlanId): CustomPlan {
  if (plan.days.length >= MAX_PLAN_DAYS) return plan;
  return { ...plan, days: [...plan.days, emptyDay(id, plan.days)] };
}

export function removeDay(plan: CustomPlan, dayId: string): CustomPlan {
  if (!plan.days.some((day) => day.id === dayId)) return plan;
  return { ...plan, days: plan.days.filter((day) => day.id !== dayId) };
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] | null {
  const target = index + offset;
  if (index === -1 || target < 0 || target >= items.length) return null;
  const moved = [...items];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}

export function moveDay(plan: CustomPlan, dayId: string, offset: -1 | 1): CustomPlan {
  const days = moveItem(
    plan.days,
    plan.days.findIndex((day) => day.id === dayId),
    offset,
  );
  return days ? { ...plan, days } : plan;
}

export type DayTexts = Partial<Pick<PlanDay, "label" | "title" | "focus">>;

export function updateDayTexts(plan: CustomPlan, dayId: string, texts: DayTexts): CustomPlan {
  return mapDay(plan, dayId, (day) => ({
    ...day,
    label: (texts.label ?? day.label).slice(0, MAX_DAY_LABEL_LENGTH),
    title: (texts.title ?? day.title).slice(0, MAX_DAY_TITLE_LENGTH),
    focus: (texts.focus ?? day.focus).slice(0, MAX_DAY_FOCUS_LENGTH),
  }));
}

function mapDay(plan: CustomPlan, dayId: string, edit: (day: PlanDay) => PlanDay): CustomPlan {
  const index = plan.days.findIndex((day) => day.id === dayId);
  if (index === -1) return plan;
  const edited = edit(plan.days[index]);
  if (edited === plan.days[index]) return plan;
  return { ...plan, days: plan.days.with(index, edited) };
}

export function addExercise(plan: CustomPlan, dayId: string, name: string): CustomPlan {
  return mapDay(plan, dayId, (day) => {
    if (day.exercises.length >= MAX_DAY_EXERCISES) return day;
    if (day.exercises.some((exercise) => exercise.name === name)) return day;
    return {
      ...day,
      exercises: [...day.exercises, { name, sets: DEFAULT_SETS, reps: DEFAULT_REPS }],
    };
  });
}

export function removeExercise(plan: CustomPlan, dayId: string, name: string): CustomPlan {
  return mapDay(plan, dayId, (day) =>
    day.exercises.some((exercise) => exercise.name === name)
      ? { ...day, exercises: day.exercises.filter((exercise) => exercise.name !== name) }
      : day,
  );
}

export function moveExercise(
  plan: CustomPlan,
  dayId: string,
  name: string,
  offset: -1 | 1,
): CustomPlan {
  return mapDay(plan, dayId, (day) => {
    const exercises = moveItem(
      day.exercises,
      day.exercises.findIndex((exercise) => exercise.name === name),
      offset,
    );
    return exercises ? { ...day, exercises } : day;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function setExerciseTarget(
  plan: CustomPlan,
  dayId: string,
  name: string,
  target: Partial<Pick<PlanExercise, "sets" | "reps">>,
): CustomPlan {
  return mapDay(plan, dayId, (day) => {
    const index = day.exercises.findIndex((exercise) => exercise.name === name);
    if (index === -1) return day;
    const exercise = day.exercises[index];
    const sets = target.sets === undefined ? exercise.sets : clamp(target.sets, 1, MAX_SETS);
    const reps = target.reps === undefined ? exercise.reps : clamp(target.reps, 1, MAX_REPS);
    if (sets === exercise.sets && reps === exercise.reps) return day;
    return { ...day, exercises: day.exercises.with(index, { ...exercise, sets, reps }) };
  });
}

// Newer updatedAt wins a shared id (tie → import). Existing plans are never dropped; imports
// past the cap or reusing another plan's day ids are skipped and counted.
export function mergeCustomPlans(
  existing: CustomPlan[],
  imported: CustomPlan[],
): { plans: CustomPlan[]; skipped: number } {
  const plans = [...existing];
  let skipped = 0;
  for (const candidate of imported) {
    const index = plans.findIndex((plan) => plan.id === candidate.id);
    const otherDayIds = new Set(plans.filter((plan) => plan.id !== candidate.id).flatMap(dayIds));
    if (dayIds(candidate).some((id) => otherDayIds.has(id))) {
      skipped++;
    } else if (index !== -1) {
      if (Date.parse(candidate.updatedAt) >= Date.parse(plans[index].updatedAt)) {
        plans[index] = candidate;
      }
    } else if (plans.length >= MAX_CUSTOM_PLANS) {
      skipped++;
    } else {
      plans.push(candidate);
    }
  }
  return { plans, skipped };
}
