export type Movement = "push" | "pull" | "hinge" | "squat";

export type Exercise = {
  name: string;
  sets: number;
  reps: number;
  muscles: string[];
  movement: Movement;
  youtube: string;
};

export type WorkoutDay = {
  id: string;
  label: string;
  title: string;
  focus: string;
  exercises: Exercise[];
};

export const movementLabels: Record<Movement, string> = {
  push: "Push",
  pull: "Pull",
  hinge: "Hinge",
  squat: "Squat",
};

// Only id and label are needed here, so both functions below take the
// structural minimum rather than WorkoutDay[] — that keeps their tests
// synthetic without hand-building exercise lists.
type DayRef = { id: string; label: string };

// Distinct training days across logged items (sessions, chart points): known
// days first in the order the caller passes them (see knownDays in
// lib/plans.ts — the active plan's days, then every other plan's), then days
// no plan knows in encounter order. Drives the session trend chart's legend.
export function distinctDays(
  items: { dayId: string; dayLabel: string }[],
  days: DayRef[],
): DayRef[] {
  const present = new Map(items.map((item) => [item.dayId, item.dayLabel]));
  const distinct: DayRef[] = [];
  for (const day of days) {
    if (present.delete(day.id)) distinct.push({ id: day.id, label: day.label });
  }
  for (const [id, label] of present) distinct.push({ id, label });
  return distinct;
}

// Categorical slots available to day series, in palette order (that order is
// the colorblind-safety mechanism — never reorder). chart-3 is reserved for
// the exercise-scoped charts (ExerciseTotalsChart, ExerciseTrendChart,
// MuscleTotalsChart), which leaves exactly four — the number of days the two
// shipped plans have between them, so every known day gets its own hue.
//
// A third plan would exhaust this. That is the tipping point named in
// CLAUDE.md: extend the CVD-validated palette in app/globals.css before
// adding one, or accept that days past the fourth share the neutral.
const DAY_COLOR_SLOTS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

// Days no plan knows — an imported backup, a retired id — are not a peer
// category worth minting a hue for, so they read as de-emphasized rather than
// as another series.
const UNKNOWN_DAY_COLOR = "var(--muted-foreground)";

export type DayLegendEntry = DayRef & { color: string };

// The legend for the days present in `items`, colored by their position in
// `days` rather than by which sessions are in view — so a day keeps its color
// no matter how the date filter narrows the data. Days past the palette and
// days no plan knows fall back to the neutral.
export function dayLegend(
  items: { dayId: string; dayLabel: string }[],
  days: DayRef[],
): DayLegendEntry[] {
  const colors = new Map(days.map((day, i) => [day.id, DAY_COLOR_SLOTS[i] ?? UNKNOWN_DAY_COLOR]));
  // Mutating is safe — distinctDays builds these objects fresh for this call.
  return distinctDays(items, days).map((day) =>
    Object.assign(day, { color: colors.get(day.id) ?? UNKNOWN_DAY_COLOR }),
  );
}
