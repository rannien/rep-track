import { describe, expect, it } from "vitest";
import { knownDays, plans } from "./plans";
import { dayLegend, distinctDays } from "./workouts";

// The plans are hand-edited data, and parts of them act as identifiers: day
// ids key sessions, and an exercise's *name* is the join key between a plan
// and every logged set (entries store the name, not an id). These invariants
// are what a typo in a lib/plan-*.ts file would silently break — the type
// system can't check any of them. Day-id and day-label uniqueness are
// asserted across all plans in plans.test.ts, where the registry lives.

const allDays = plans.flatMap((plan) => plan.days.map((day) => ({ plan: plan.id, day })));
const allExercises = allDays.flatMap(({ plan, day }) =>
  day.exercises.map((exercise) => ({ plan, day: day.id, exercise })),
);

describe("workout plan data integrity", () => {
  it("gives every day an id, label, title, and focus", () => {
    for (const { plan, day } of allDays) {
      expect(day.id, plan).not.toBe("");
      expect(day.label, plan).not.toBe("");
      expect(day.title, plan).not.toBe("");
      expect(day.focus, plan).not.toBe("");
      expect(day.exercises.length, plan).toBeGreaterThan(0);
    }
  });

  it("keeps exercise names unique within a day", () => {
    // Two same-named exercises on one day would share a single log entry —
    // sets logged under either would merge into one history.
    for (const { plan, day } of allDays) {
      const names = day.exercises.map((exercise) => exercise.name);
      expect(new Set(names).size, `${plan}/${day.id}`).toBe(names.length);
    }
  });

  it("gives every exercise a name, positive integer sets/reps, and muscles", () => {
    for (const { plan, exercise } of allExercises) {
      const where = `${plan}/${exercise.name}`;
      expect(exercise.name, plan).not.toBe("");
      expect(Number.isInteger(exercise.sets) && exercise.sets > 0, where).toBe(true);
      expect(Number.isInteger(exercise.reps) && exercise.reps > 0, where).toBe(true);
      expect(exercise.muscles.length, where).toBeGreaterThan(0);
      for (const muscle of exercise.muscles) expect(muscle, where).not.toBe("");
    }
  });

  it("links every exercise to a YouTube form search", () => {
    for (const { plan, exercise } of allExercises) {
      expect(exercise.youtube, `${plan}/${exercise.name}`).toMatch(
        /^https:\/\/www\.youtube\.com\//,
      );
    }
  });

  it("gives an exercise name one canonical definition across plans", () => {
    // muscleTotals buckets by exercise name over all history, last write
    // winning, so a name meaning different muscles in different plans would
    // let registry order decide what it trains. sets/reps are deliberately
    // not compared: a different prescription is the point of a second plan.
    const byName = new Map<
      string,
      { plan: string; muscles: string[]; movement: string; youtube: string }
    >();
    for (const { plan, exercise } of allExercises) {
      const seen = byName.get(exercise.name);
      if (seen === undefined) {
        byName.set(exercise.name, {
          plan,
          muscles: exercise.muscles,
          movement: exercise.movement,
          youtube: exercise.youtube,
        });
        continue;
      }
      const where = `${exercise.name} (${seen.plan} vs ${plan})`;
      expect(exercise.muscles.toSorted(), where).toEqual(seen.muscles.toSorted());
      expect(exercise.movement, where).toBe(seen.movement);
      expect(exercise.youtube, where).toBe(seen.youtube);
    }
  });

  it("keeps colons out of exercise names", () => {
    // ExerciseRow builds its panel key as `${dayId}:${exercise.name}`, so a
    // colon in a name would make two different keys ambiguous.
    for (const { plan, exercise } of allExercises) {
      expect(exercise.name, plan).not.toContain(":");
    }
  });
});

// Synthetic day lists throughout: distinctDays and dayLegend take the days as
// a parameter precisely so hand-editing a plan can't break these tests.
const dayA = { id: "day-a", label: "Day A" };
const dayB = { id: "day-b", label: "Day B" };
const otherPlanDay = { id: "day-other", label: "Other Plan Day" };
const known = [dayA, dayB, otherPlanDay];

function itemsFor(...days: { id: string; label: string }[]) {
  return days.map((day) => ({ dayId: day.id, dayLabel: day.label }));
}

describe("distinctDays", () => {
  it("dedupes and orders by the given day order, not encounter order", () => {
    const reversed = [dayB, dayA].flatMap((day) => itemsFor(day, day));

    expect(distinctDays(reversed, known)).toEqual([dayA, dayB]);
  });

  it("orders another plan's day after the active plan's but before an unknown id", () => {
    const items = [
      { dayId: "day-retired", dayLabel: "Old Split" },
      ...itemsFor(otherPlanDay, dayA),
    ];

    expect(distinctDays(items, known)).toEqual([
      dayA,
      otherPlanDay,
      { id: "day-retired", label: "Old Split" },
    ]);
  });

  it("takes an unknown day's label from the logged item, a known day's from the plan", () => {
    const items = [
      { dayId: "day-a", dayLabel: "Stale Snapshot" },
      { dayId: "day-retired", dayLabel: "Old Split" },
    ];

    expect(distinctDays(items, known)).toEqual([
      { id: "day-a", label: "Day A" },
      { id: "day-retired", label: "Old Split" },
    ]);
  });

  it("returns no days for no items", () => {
    expect(distinctDays([], known)).toEqual([]);
  });
});

describe("dayLegend", () => {
  it("colors days by their position in the day list, in palette order", () => {
    expect(dayLegend(itemsFor(dayA, dayB, otherPlanDay), known)).toEqual([
      { ...dayA, color: "var(--chart-1)" },
      { ...dayB, color: "var(--chart-2)" },
      { ...otherPlanDay, color: "var(--chart-4)" },
    ]);
  });

  it("keeps a day's color when the other days are filtered out of view", () => {
    // The documented invariant: a day keeps its color no matter which
    // sessions are in view, so a date filter can't recolor the chart.
    expect(dayLegend(itemsFor(dayB), known)).toEqual([{ ...dayB, color: "var(--chart-2)" }]);
    expect(dayLegend(itemsFor(otherPlanDay), known)).toEqual([
      { ...otherPlanDay, color: "var(--chart-4)" },
    ]);
  });

  it("has a distinct hue for every day the shipped plans actually define", () => {
    // The claim session-trend-chart's comment makes: a session logged under
    // the non-active plan is a peer series, not an unknown day.
    for (const plan of plans) {
      const days = knownDays(plan.id);
      const colors = dayLegend(
        days.map((day) => ({ dayId: day.id, dayLabel: day.label })),
        days,
      ).map((entry) => entry.color);

      expect(new Set(colors).size, plan.id).toBe(days.length);
      expect(colors, plan.id).not.toContain("var(--muted-foreground)");
    }
  });

  it("gives all four known days their own hue — the two shipped plans' full day count", () => {
    const fourth = { id: "day-fourth", label: "Fourth" };
    const colors = dayLegend(itemsFor(...known, fourth), [...known, fourth]).map((d) => d.color);

    expect(colors).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-4)",
      "var(--chart-5)",
    ]);
    expect(new Set(colors).size).toBe(4);
  });

  it("reads a day no plan knows as neutral, not as another series", () => {
    const retired = { dayId: "day-retired", dayLabel: "Old Split" };

    expect(dayLegend([retired], known)).toEqual([
      { id: "day-retired", label: "Old Split", color: "var(--muted-foreground)" },
    ]);
  });

  it("falls back to the neutral once the palette is exhausted", () => {
    // Documents the third-plan tipping point rather than failing silently.
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `day-${i}`, label: `Day ${i}` }));
    const colors = dayLegend(itemsFor(...many), many).map((d) => d.color);

    expect(colors.slice(4)).toEqual(["var(--muted-foreground)", "var(--muted-foreground)"]);
  });

  it("never hands out chart-3, which the exercise-scoped charts own", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `day-${i}`, label: `Day ${i}` }));

    for (const entry of dayLegend(itemsFor(...many), many)) {
      expect(entry.color).not.toBe("var(--chart-3)");
    }
  });

  it("returns no entries for no items", () => {
    expect(dayLegend([], known)).toEqual([]);
  });
});
