import { describe, expect, it } from "vitest";
import {
  type CustomPlan,
  type CustomPlanId,
  DEFAULT_REPS,
  DEFAULT_SETS,
  MAX_CUSTOM_PLANS,
  MAX_DAY_EXERCISES,
  MAX_PLAN_DAYS,
  MAX_SETS,
  addDay,
  addExercise,
  copyPlan,
  createPlan,
  isCustomId,
  isUsable,
  mergeCustomPlans,
  moveDay,
  moveExercise,
  parseCustomPlansArray,
  parseCustomPlansBlob,
  removeDay,
  removeExercise,
  renamePlan,
  setExerciseTarget,
  updateDayTexts,
} from "./custom-plans";
import { MAX_REPS } from "./sessions";
import type { PlanDay, PlanExercise } from "./workouts";

const NOW = "2026-07-22T09:00:00.000Z";

function customId(n: number): CustomPlanId {
  return `custom-00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function idSequence(start: number): () => CustomPlanId {
  let next = start;
  return () => customId(next++);
}

function exercise(name: string, overrides: Partial<PlanExercise> = {}): PlanExercise {
  return { name, sets: 3, reps: 8, ...overrides };
}

function day(id: number, overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    id: customId(id),
    label: "Day A",
    title: "Upper",
    focus: "Push and pull",
    exercises: [exercise("Bench Press"), exercise("Barbell Row")],
    ...overrides,
  };
}

// Plan n owns ids n*100 (the plan) and n*100+1.. (its days).
function makePlan(n: number, overrides: Partial<CustomPlan> = {}): CustomPlan {
  return {
    id: customId(n * 100),
    name: `Plan ${n}`,
    updatedAt: NOW,
    days: [day(n * 100 + 1), day(n * 100 + 2, { label: "Day B" })],
    ...overrides,
  };
}

function exercises(count: number): PlanExercise[] {
  return Array.from({ length: count }, (_, index) => exercise(`Lift ${index}`));
}

function days(count: number, base: number): PlanDay[] {
  return Array.from({ length: count }, (_, index) => day(base + index));
}

function withExercise(overrides: Partial<PlanExercise>): CustomPlan {
  return makePlan(1, { days: [day(101, { exercises: [exercise("Squat", overrides)] })] });
}

describe("parseCustomPlansBlob", () => {
  it("round-trips valid plans", () => {
    const plans = [makePlan(1), makePlan(2)];

    const result = parseCustomPlansBlob(JSON.stringify(plans));

    expect(result).toEqual({ kind: "ok", plans });
  });

  it("treats a missing or empty blob as no plans", () => {
    expect(parseCustomPlansBlob(null)).toEqual({ kind: "ok", plans: [] });
    expect(parseCustomPlansBlob("")).toEqual({ kind: "ok", plans: [] });
  });

  it("reports unparseable JSON as corrupt", () => {
    expect(parseCustomPlansBlob("{not json")).toEqual({ kind: "corrupt", plans: [] });
  });

  it("reports a non-array payload as corrupt", () => {
    expect(parseCustomPlansBlob('{"plans":[]}')).toEqual({ kind: "corrupt", plans: [] });
    expect(parseCustomPlansArray(null)).toEqual({ kind: "corrupt", plans: [] });
  });

  it("neutralizes prototype-pollution keys at plan, day and exercise level", () => {
    const hostile = '"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}';
    const raw =
      `[{"id":"${customId(100)}","name":"P","updatedAt":"${NOW}",${hostile},` +
      `"days":[{"id":"${customId(101)}","label":"A","title":"","focus":"",${hostile},` +
      `"exercises":[{"name":"Squat","sets":3,"reps":5,${hostile}}]}]}]`;

    const result = parseCustomPlansBlob(raw);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.kind).toBe("ok");
    const [plan] = result.plans;
    expect(Object.keys(plan).toSorted()).toEqual(["days", "id", "name", "updatedAt"]);
    expect(Object.keys(plan.days[0]).toSorted()).toEqual([
      "exercises",
      "focus",
      "id",
      "label",
      "title",
    ]);
    expect(Object.keys(plan.days[0].exercises[0]).toSorted()).toEqual(["name", "reps", "sets"]);
  });

  it("does not read inherited fields at plan, day or exercise level", () => {
    const valid = makePlan(1);
    const inheritedPlan = Object.create(valid);
    const inheritedDay = { ...valid, days: [Object.create(valid.days[0])] };
    const inheritedExercise = {
      ...valid,
      days: [{ ...valid.days[0], exercises: [Object.create(valid.days[0].exercises[0])] }],
    };

    const results = [inheritedPlan, inheritedDay, inheritedExercise].map((plan) =>
      parseCustomPlansArray([plan]),
    );

    for (const result of results) {
      expect(result).toEqual({ kind: "partial", plans: [], dropped: 1 });
    }
  });
});

describe("parseCustomPlansArray limits", () => {
  it("keeps the first MAX_CUSTOM_PLANS plans and drops the rest", () => {
    const plans = Array.from({ length: MAX_CUSTOM_PLANS + 1 }, (_, index) => makePlan(index + 1));

    const result = parseCustomPlansArray(plans);

    expect(result).toEqual({
      kind: "partial",
      plans: plans.slice(0, MAX_CUSTOM_PLANS),
      dropped: 1,
    });
  });

  it("accepts every field exactly at its limit", () => {
    const plan = makePlan(1, {
      name: "n".repeat(40),
      days: [
        day(101, {
          label: "l".repeat(12),
          title: "t".repeat(40),
          focus: "f".repeat(60),
          exercises: [
            ...exercises(MAX_DAY_EXERCISES - 2),
            exercise("Top", { sets: MAX_SETS, reps: MAX_REPS }),
            exercise("Bottom", { sets: 1, reps: 1 }),
          ],
        }),
        ...days(MAX_PLAN_DAYS - 1, 102),
      ],
    });

    expect(parseCustomPlansArray([plan])).toEqual({ kind: "ok", plans: [plan] });
  });

  it.each([
    ["more than MAX_PLAN_DAYS days", makePlan(1, { days: days(MAX_PLAN_DAYS + 1, 101) })],
    [
      "more than MAX_DAY_EXERCISES exercises",
      makePlan(1, { days: [day(101, { exercises: exercises(MAX_DAY_EXERCISES + 1) })] }),
    ],
    ["0 sets", withExercise({ sets: 0 })],
    ["sets above MAX_SETS", withExercise({ sets: MAX_SETS + 1 })],
    ["non-integer sets", withExercise({ sets: 2.5 })],
    ["0 reps", withExercise({ reps: 0 })],
    ["reps above MAX_REPS", withExercise({ reps: MAX_REPS + 1 })],
    ["a blank exercise name", withExercise({ name: "  " })],
    ["a plan name over 40 characters", makePlan(1, { name: "n".repeat(41) })],
    [
      "a day label over 12 characters",
      makePlan(1, { days: [day(101, { label: "l".repeat(13) })] }),
    ],
    [
      "a day title over 40 characters",
      makePlan(1, { days: [day(101, { title: "t".repeat(41) })] }),
    ],
    [
      "a day focus over 60 characters",
      makePlan(1, { days: [day(101, { focus: "f".repeat(61) })] }),
    ],
    ["an unparseable updatedAt", makePlan(1, { updatedAt: "yesterday" })],
    ["an updatedAt without a UTC designator", makePlan(1, { updatedAt: "2026-10-09T10:00:00" })],
    ["a date-only updatedAt", makePlan(1, { updatedAt: "2026-10-09" })],
    [
      "a plan id without the custom prefix",
      makePlan(1, { id: "barbell-strength" as CustomPlanId }),
    ],
    ["a day id that is not a custom id", makePlan(1, { days: [{ ...day(101), id: "day-a" }] })],
    [
      "a duplicate exercise name within a day",
      makePlan(1, { days: [day(101, { exercises: [exercise("Squat"), exercise("Squat")] })] }),
    ],
    ["two days sharing an id", makePlan(1, { days: [day(101), day(101)] })],
  ])("drops a plan with %s", (_, plan) => {
    const result = parseCustomPlansArray([plan, makePlan(2)]);

    expect(result).toEqual({ kind: "partial", plans: [makePlan(2)], dropped: 1 });
  });

  it("drops a later plan reusing an earlier plan's id", () => {
    const first = makePlan(1);
    const second = makePlan(2, { id: first.id });

    const result = parseCustomPlansArray([first, second]);

    expect(result).toEqual({ kind: "partial", plans: [first], dropped: 1 });
  });

  it("drops a later plan sharing a day id with an earlier plan", () => {
    const first = makePlan(1);
    const second = makePlan(2, { days: [day(201), first.days[1]] });

    const result = parseCustomPlansArray([first, second]);

    expect(result).toEqual({ kind: "partial", plans: [first], dropped: 1 });
  });

  it("accepts draft states: empty name, no days, an empty day, blank texts", () => {
    const plans = [
      makePlan(1, { name: "", days: [] }),
      makePlan(2, { days: [day(201, { label: "", title: "", focus: "", exercises: [] })] }),
    ];

    expect(parseCustomPlansArray(plans)).toEqual({ kind: "ok", plans });
  });
});

describe("isCustomId", () => {
  it("accepts the custom prefix with a lowercase v4 uuid", () => {
    expect(isCustomId("custom-3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f")).toBe(true);
    expect(isCustomId(customId(7))).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      "custom-3F2B8C1E-9A4D-4E6F-B123-0A1B2C3D4E5F",
      "custom-",
      "custom-__proto__",
      "custom-3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f-x",
      "custom-3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f\n",
      "custom-3f2b8c1e-9a4d-1e6f-b123-0a1b2c3d4e5f",
      "3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f",
      'custom-x"]{}',
      `x${customId(1)}`,
      null,
      42,
    ]) {
      expect(isCustomId(value), String(value)).toBe(false);
    }
  });
});

describe("createPlan", () => {
  it("creates a plan with one empty day, fresh ids and the given timestamp", () => {
    const plan = createPlan("Upper/Lower", idSequence(1), NOW);

    expect(plan).toEqual({
      id: customId(1),
      name: "Upper/Lower",
      updatedAt: NOW,
      days: [{ id: customId(2), label: "Day A", title: "", focus: "", exercises: [] }],
    });
  });

  it("truncates the name to 40 characters", () => {
    expect(createPlan("n".repeat(50), idSequence(1), NOW).name).toBe("n".repeat(40));
  });
});

describe("copyPlan", () => {
  const source = {
    name: "Barbell Strength",
    days: [
      {
        id: "barbell-a",
        label: "Day A",
        title: "Squat",
        focus: "Legs",
        exercises: [{ name: "Squat", sets: 5, reps: 5, muscles: ["quads"], youtube: "x" }],
      },
      { id: "barbell-b", label: "Day B", title: "Deadlift", focus: "Back", exercises: [] },
    ],
  };

  it("copies names and targets under fresh ids", () => {
    const copy = copyPlan(source, idSequence(1), NOW);

    expect(copy).toEqual({
      id: customId(1),
      name: "Barbell Strength (copy)",
      updatedAt: NOW,
      days: [
        {
          id: customId(2),
          label: "Day A",
          title: "Squat",
          focus: "Legs",
          exercises: [{ name: "Squat", sets: 5, reps: 5 }],
        },
        { id: customId(3), label: "Day B", title: "Deadlift", focus: "Back", exercises: [] },
      ],
    });
  });

  it("never reuses an id from a custom source", () => {
    const original = makePlan(1);

    const copy = copyPlan(original, idSequence(500), NOW);

    const sourceIds = new Set([original.id, ...original.days.map((d) => d.id)]);
    const copyIds = [copy.id, ...copy.days.map((d) => d.id)];
    expect(copyIds.filter((id) => sourceIds.has(id))).toEqual([]);
  });

  it("truncates the copied name to 40 characters", () => {
    const copy = copyPlan({ name: "n".repeat(38), days: [] }, idSequence(1), NOW);

    expect(copy.name).toBe(`${"n".repeat(38)} (`);
  });
});

describe("renamePlan", () => {
  it("renames, truncating to 40 characters", () => {
    expect(renamePlan(makePlan(1), "Push").name).toBe("Push");
    expect(renamePlan(makePlan(1), "n".repeat(41)).name).toBe("n".repeat(40));
  });
});

describe("addDay", () => {
  it("appends an empty day labelled with the first free letter", () => {
    const plan = makePlan(1, {
      days: [day(101, { label: "Day A" }), day(102, { label: "Day C" })],
    });

    const result = addDay(plan, customId(103));

    expect(result.days[2]).toEqual({
      id: customId(103),
      label: "Day B",
      title: "",
      focus: "",
      exercises: [],
    });
  });

  it("returns the same plan once MAX_PLAN_DAYS is reached", () => {
    const plan = makePlan(1, { days: days(MAX_PLAN_DAYS, 101) });

    expect(addDay(plan, customId(199))).toBe(plan);
  });
});

describe("removeDay", () => {
  it("removes the day", () => {
    const plan = makePlan(1);

    expect(removeDay(plan, customId(101)).days.map((d) => d.id)).toEqual([customId(102)]);
  });

  it("returns the same plan for an unknown day", () => {
    const plan = makePlan(1);

    expect(removeDay(plan, customId(999))).toBe(plan);
  });
});

describe("moveDay", () => {
  it("swaps the day with its neighbour", () => {
    const plan = makePlan(1);

    expect(moveDay(plan, customId(101), 1).days.map((d) => d.id)).toEqual([
      customId(102),
      customId(101),
    ]);
    expect(moveDay(plan, customId(102), -1).days.map((d) => d.id)).toEqual([
      customId(102),
      customId(101),
    ]);
  });

  it("returns the same plan when moving past either end or for an unknown day", () => {
    const plan = makePlan(1);

    expect(moveDay(plan, customId(101), -1)).toBe(plan);
    expect(moveDay(plan, customId(102), 1)).toBe(plan);
    expect(moveDay(plan, customId(999), 1)).toBe(plan);
  });
});

describe("updateDayTexts", () => {
  it("updates only the given texts, truncating each to its cap", () => {
    const plan = makePlan(1);

    const result = updateDayTexts(plan, customId(101), {
      label: "l".repeat(20),
      focus: "f".repeat(70),
    });

    expect(result.days[0]).toMatchObject({
      label: "l".repeat(12),
      title: "Upper",
      focus: "f".repeat(60),
    });
    expect(result.days[1]).toBe(plan.days[1]);
  });

  it("truncates the title to 40 characters", () => {
    const result = updateDayTexts(makePlan(1), customId(101), { title: "t".repeat(41) });

    expect(result.days[0].title).toBe("t".repeat(40));
  });

  it("returns the same plan for an unknown day", () => {
    const plan = makePlan(1);

    expect(updateDayTexts(plan, customId(999), { label: "X" })).toBe(plan);
  });
});

describe("addExercise", () => {
  it("appends the exercise with default targets", () => {
    const result = addExercise(makePlan(1), customId(101), "Squat");

    expect(result.days[0].exercises.at(-1)).toEqual({
      name: "Squat",
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
    });
  });

  it("returns the same plan for a duplicate name, a full day or an unknown day", () => {
    const plan = makePlan(1, {
      days: [day(101), day(102, { exercises: exercises(MAX_DAY_EXERCISES) })],
    });

    expect(addExercise(plan, customId(101), "Bench Press")).toBe(plan);
    expect(addExercise(plan, customId(102), "Squat")).toBe(plan);
    expect(addExercise(plan, customId(999), "Squat")).toBe(plan);
  });
});

describe("removeExercise", () => {
  it("removes the named exercise", () => {
    const result = removeExercise(makePlan(1), customId(101), "Bench Press");

    expect(result.days[0].exercises.map((e) => e.name)).toEqual(["Barbell Row"]);
  });

  it("returns the same plan for an unknown exercise", () => {
    const plan = makePlan(1);

    expect(removeExercise(plan, customId(101), "Squat")).toBe(plan);
  });
});

describe("moveExercise", () => {
  it("swaps the exercise with its neighbour", () => {
    const result = moveExercise(makePlan(1), customId(101), "Bench Press", 1);

    expect(result.days[0].exercises.map((e) => e.name)).toEqual(["Barbell Row", "Bench Press"]);
  });

  it("returns the same plan when moving past either end or for an unknown exercise", () => {
    const plan = makePlan(1);

    expect(moveExercise(plan, customId(101), "Bench Press", -1)).toBe(plan);
    expect(moveExercise(plan, customId(101), "Barbell Row", 1)).toBe(plan);
    expect(moveExercise(plan, customId(101), "Squat", 1)).toBe(plan);
  });
});

function targetOf(plan: CustomPlan) {
  const { sets, reps } = plan.days[0].exercises[0];
  return { sets, reps };
}

describe("setExerciseTarget", () => {
  it("sets the given target and keeps the other", () => {
    const result = setExerciseTarget(makePlan(1), customId(101), "Bench Press", { reps: 12 });

    expect(targetOf(result)).toEqual({ sets: 3, reps: 12 });
  });

  it("keeps the reps when only the sets change", () => {
    const result = setExerciseTarget(makePlan(1), customId(101), "Bench Press", { sets: 5 });

    expect(targetOf(result)).toEqual({ sets: 5, reps: 8 });
  });

  it("clamps sets to 1..MAX_SETS and reps to 1..MAX_REPS", () => {
    const plan = makePlan(1);

    const low = setExerciseTarget(plan, customId(101), "Bench Press", { sets: 0, reps: 0 });
    const high = setExerciseTarget(plan, customId(101), "Bench Press", { sets: 99, reps: 9999 });

    expect(targetOf(low)).toEqual({ sets: 1, reps: 1 });
    expect(targetOf(high)).toEqual({ sets: MAX_SETS, reps: MAX_REPS });
  });

  it("rounds fractional targets", () => {
    const result = setExerciseTarget(makePlan(1), customId(101), "Bench Press", {
      sets: 4.6,
      reps: 7.2,
    });

    expect(targetOf(result)).toEqual({ sets: 5, reps: 7 });
  });

  it("returns the same plan for an unchanged target or an unknown exercise", () => {
    const plan = makePlan(1);

    expect(setExerciseTarget(plan, customId(101), "Bench Press", { sets: 3, reps: 8 })).toBe(plan);
    expect(setExerciseTarget(plan, customId(101), "Squat", { sets: 5 })).toBe(plan);
  });
});

describe("editing ops", () => {
  it("never mutate the plan they are given", () => {
    const plan = makePlan(1);
    const before = structuredClone(plan);

    renamePlan(plan, "X");
    addDay(plan, customId(103));
    removeDay(plan, customId(101));
    moveDay(plan, customId(101), 1);
    updateDayTexts(plan, customId(101), { label: "X", title: "X", focus: "X" });
    addExercise(plan, customId(101), "Squat");
    removeExercise(plan, customId(101), "Bench Press");
    moveExercise(plan, customId(101), "Bench Press", 1);
    setExerciseTarget(plan, customId(101), "Bench Press", { sets: 5, reps: 5 });
    copyPlan(plan, idSequence(500), NOW);

    expect(plan).toEqual(before);
  });
});

describe("isUsable", () => {
  it("requires at least one day and an exercise on every day", () => {
    expect(isUsable(makePlan(1))).toBe(true);
    expect(isUsable(makePlan(1, { days: [] }))).toBe(false);
    expect(isUsable(makePlan(1, { days: [day(101), day(102, { exercises: [] })] }))).toBe(false);
  });
});

describe("mergeCustomPlans", () => {
  const older = "2026-07-01T00:00:00.000Z";
  const newer = "2026-07-02T00:00:00.000Z";

  it("lets the newer copy of a shared plan win", () => {
    const local = makePlan(1, { name: "local", updatedAt: older });
    const imported = makePlan(1, { name: "imported", updatedAt: newer });

    expect(mergeCustomPlans([local], [imported])).toEqual({ plans: [imported], skipped: 0 });
  });

  it("lets the imported copy win a tie", () => {
    const local = makePlan(1, { name: "local" });
    const imported = makePlan(1, { name: "imported" });

    expect(mergeCustomPlans([local], [imported]).plans).toEqual([imported]);
  });

  it("ignores an older imported copy", () => {
    const local = makePlan(1, { name: "local", updatedAt: newer });
    const imported = makePlan(1, { name: "imported", updatedAt: older });

    expect(mergeCustomPlans([local], [imported])).toEqual({ plans: [local], skipped: 0 });
  });

  it("appends new plans and keeps every existing one", () => {
    const existing = [makePlan(1), makePlan(2)];

    const result = mergeCustomPlans(existing, [makePlan(3)]);

    expect(result).toEqual({ plans: [...existing, makePlan(3)], skipped: 0 });
  });

  it("skips and counts new plans beyond MAX_CUSTOM_PLANS", () => {
    const existing = Array.from({ length: MAX_CUSTOM_PLANS - 1 }, (_, index) =>
      makePlan(index + 1),
    );

    const result = mergeCustomPlans(existing, [makePlan(50), makePlan(51), makePlan(52)]);

    expect(result).toEqual({ plans: [...existing, makePlan(50)], skipped: 2 });
  });

  it("skips an imported plan whose day ids belong to another plan", () => {
    const local = makePlan(1);
    const imported = makePlan(2, { days: [local.days[0]] });

    expect(mergeCustomPlans([local], [imported])).toEqual({ plans: [local], skipped: 1 });
  });
});
