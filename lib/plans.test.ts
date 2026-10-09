import { describe, expect, it } from "vitest";
import snapshot from "./catalog-snapshot.json";
import {
  type CatalogExercise,
  DEFAULT_WWWORKOUT_URL,
  catalogByName,
  parseCatalog,
} from "./catalog";
import { CUSTOM_ID_PATTERN, type CustomPlan, type CustomPlanId } from "./custom-plans";
import {
  DEFAULT_PLAN_ID,
  PLAN_INIT_SCRIPT,
  type PlanDefinition,
  type PlanId,
  type WorkoutPlan,
  enrichCustomPlans,
  enrichPlans,
  knownDays,
  parseStoredPlanId,
  planById,
  planDefinitions,
  resolvePlanId,
} from "./plans";
import { youtubeSearchUrl } from "./workouts";

const snapshotCatalog = catalogByName(
  parseCatalog(snapshot, new URL(DEFAULT_WWWORKOUT_URL).origin),
);
const shippedPlans = () => enrichPlans(planDefinitions, [snapshotCatalog]);

const CUSTOM_A: CustomPlanId = "custom-3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f";
const CUSTOM_B: CustomPlanId = "custom-00000000-0000-4000-8000-000000000001";
const malformedCustomIds = [
  "custom-",
  "custom-__proto__",
  "custom-3F2B8C1E-9A4D-4E6F-B123-0A1B2C3D4E5F",
  `${CUSTOM_A}-x`,
  `${CUSTOM_A}\n`,
  'custom-x"]{}',
];

// The registry is hand-edited data whose identifiers are load-bearing: a plan
// id is a stored preference value, and a day id keys every logged session.
// These invariants are what a typo would silently break, and none of them is
// checkable by the type system.

describe("parseStoredPlanId", () => {
  it("accepts every id this build ships", () => {
    for (const plan of planDefinitions) {
      expect(parseStoredPlanId(plan.id)).toBe(plan.id);
    }
  });

  it("rejects everything else", () => {
    for (const raw of [null, "", "Barbell-Strength", " barbell-strength", "0", "nope"]) {
      expect(parseStoredPlanId(raw)).toBeNull();
    }
  });

  it("accepts a well-formed custom id", () => {
    expect(parseStoredPlanId(CUSTOM_A)).toBe(CUSTOM_A);
  });

  it("rejects a malformed custom id", () => {
    for (const raw of malformedCustomIds) {
      expect(parseStoredPlanId(raw), raw).toBeNull();
    }
  });

  it("rejects prototype keys rather than resolving them", () => {
    // The reason the parser is an array lookup and not an object index.
    for (const raw of ["__proto__", "constructor", "toString", "valueOf"]) {
      expect(parseStoredPlanId(raw)).toBeNull();
    }
  });
});

describe("resolvePlanId", () => {
  it("falls back to the default for no stored id", () => {
    expect(resolvePlanId(null, [{ id: CUSTOM_A }])).toBe(DEFAULT_PLAN_ID);
  });

  it("falls back to the default for a custom id no stored plan has", () => {
    expect(resolvePlanId(CUSTOM_B, [{ id: CUSTOM_A }])).toBe(DEFAULT_PLAN_ID);
  });

  it("keeps a custom id that a stored plan has", () => {
    expect(resolvePlanId(CUSTOM_A, [{ id: CUSTOM_A }])).toBe(CUSTOM_A);
  });

  it("passes a built-in id through", () => {
    expect(resolvePlanId("dumbbell-hybrid", [])).toBe("dumbbell-hybrid");
  });
});

describe("plan registry", () => {
  it("never ships a plan or day id that looks like a custom id", () => {
    const ids = planDefinitions.flatMap((plan) => [plan.id, ...plan.days.map((day) => day.id)]);

    expect(ids.filter((id) => CUSTOM_ID_PATTERN.test(id))).toEqual([]);
  });

  it("ships at least two plans, each with an id, name, summary and days", () => {
    expect(shippedPlans().length).toBeGreaterThanOrEqual(2);
    for (const plan of shippedPlans()) {
      expect(plan.id).not.toBe("");
      expect(plan.name).not.toBe("");
      expect(plan.summary).not.toBe("");
      expect(plan.days.length).toBeGreaterThan(0);
    }
  });

  it("keeps plan ids unique", () => {
    const ids = shippedPlans().map((plan) => plan.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves the default plan id", () => {
    expect(planById(DEFAULT_PLAN_ID, shippedPlans()).id).toBe(DEFAULT_PLAN_ID);
  });

  it("keeps day ids unique across every plan, not just within one", () => {
    // A session keys on (dayId, dateKey) alone, so two plans sharing a day id
    // would silently merge their histories.
    const ids = shippedPlans().flatMap((plan) => plan.days.map((day) => day.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps day labels unique across every plan", () => {
    // The trend-chart legend and the /stats exercise picker show labels from
    // both plans side by side, so a duplicate label would be ambiguous there.
    const labels = shippedPlans().flatMap((plan) => plan.days.map((day) => day.label));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("finds every plan exercise name in the committed catalogue snapshot", () => {
    const names = planDefinitions.flatMap((plan) =>
      plan.days.flatMap((day) => day.exercises.map((exercise) => exercise.name)),
    );

    const missing = names.filter((name) => !snapshotCatalog.has(name));

    expect(missing).toEqual([]);
  });
});

describe("planById", () => {
  it("round-trips every id in the registry", () => {
    const plans = shippedPlans();

    for (const plan of plans) {
      expect(planById(plan.id, plans)).toBe(plan);
    }
  });

  it("throws on an id no plan claims", () => {
    expect(() => planById("nonexistent" as PlanId, shippedPlans())).toThrow(/Unknown plan id/);
  });
});

describe("knownDays", () => {
  it("puts the active plan's days first, in plan order", () => {
    const plans = shippedPlans();

    for (const plan of plans) {
      const active = plan.days.map((day) => day.id);

      expect(
        knownDays(plan.id, plans)
          .slice(0, active.length)
          .map((day) => day.id),
      ).toEqual(active);
    }
  });

  it("includes every day of every plan exactly once", () => {
    const plans = shippedPlans();
    const all = plans.flatMap((plan) => plan.days.map((day) => day.id));

    for (const plan of plans) {
      const known = knownDays(plan.id, plans).map((day) => day.id);

      expect(known.length).toBe(all.length);
      expect(new Set(known)).toEqual(new Set(all));
    }
  });
});

function workoutPlan(id: PlanId, name: string, days: [string, string][]): WorkoutPlan {
  return {
    id,
    name,
    summary: name,
    days: days.map(([dayId, label]) => ({ id: dayId, label, title: "", focus: "", exercises: [] })),
  };
}

describe("knownDays with custom plans", () => {
  const alpha = workoutPlan(CUSTOM_A, "Alpha", [
    ["a-1", "Push"],
    ["a-2", "Pull"],
  ]);
  const beta = workoutPlan(CUSTOM_B, "Beta", [
    ["b-1", "Push"],
    ["b-2", "Legs"],
  ]);
  const plans = [...shippedPlans(), alpha, beta];

  it("puts an active custom plan's days first", () => {
    expect(
      knownDays(CUSTOM_A, plans)
        .slice(0, 2)
        .map((day) => day.id),
    ).toEqual(["a-1", "a-2"]);
  });

  it("includes every day of every plan exactly once", () => {
    const all = plans.flatMap((plan) => plan.days.map((day) => day.id));

    const known = knownDays(CUSTOM_B, plans).map((day) => day.id);

    expect(known.toSorted()).toEqual(all.toSorted());
  });

  it("qualifies a colliding label on an inactive plan with its plan name", () => {
    const labels = knownDays(CUSTOM_A, plans).map((day) => [day.id, day.label]);

    expect(labels).toContainEqual(["b-1", "Beta · Push"]);
  });

  it("never qualifies the active plan's labels and leaves unique labels alone", () => {
    const labels = new Map(knownDays(CUSTOM_A, plans).map((day) => [day.id, day.label]));

    expect(labels.get("a-1")).toBe("Push");
    expect(labels.get("a-2")).toBe("Pull");
    expect(labels.get("b-2")).toBe("Legs");
  });
});

// The pre-paint path: execute the inline script string for real against
// stubbed globals and assert it lands exactly where
// parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID would.
function runScript(stored: string | null, getItem?: () => string | null) {
  const attributes: [string, string][] = [];
  new Function("localStorage", "document", PLAN_INIT_SCRIPT)(
    { getItem: getItem ?? (() => stored) },
    {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.push([name, value]),
      },
    },
  );
  return attributes;
}

describe("PLAN_INIT_SCRIPT", () => {
  it("applies a stored plan id", () => {
    for (const plan of planDefinitions) {
      expect(runScript(plan.id)).toEqual([["data-plan", plan.id]]);
    }
  });

  it("applies a stored well-formed custom id", () => {
    expect(runScript(CUSTOM_A)).toEqual([["data-plan", CUSTOM_A]]);
  });

  it("leaves the server-rendered default alone when there is nothing valid to apply", () => {
    // No setAttribute at all — the layout already rendered DEFAULT_PLAN_ID,
    // so writing it again would be redundant and writing anything else wrong.
    for (const raw of [null, "", "nope", "__proto__", "constructor"]) {
      expect(runScript(raw)).toEqual([]);
    }
  });

  it("survives storage being unavailable", () => {
    expect(() =>
      runScript(null, () => {
        throw new Error("SecurityError: storage is blocked");
      }),
    ).not.toThrow();
  });

  it("resolves identically to parseStoredPlanId for every input", () => {
    for (const raw of [
      null,
      "",
      ...planDefinitions.map((plan) => plan.id),
      "nope",
      "__proto__",
      " x",
      CUSTOM_A,
      CUSTOM_B,
      ...malformedCustomIds,
    ]) {
      const attributes = runScript(raw);
      const applied = attributes.length > 0 ? attributes[0][1] : DEFAULT_PLAN_ID;

      expect(applied).toBe(parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID);
    }
  });
});

function catalogEntry(name: string, overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: name,
    name,
    movementPattern: "push",
    mechanics: "compound",
    muscleGroups: ["chest"],
    detailUrl: `https://wwworkout.example/exercises/${name}`,
    videoUrl: `https://www.youtube.com/results?search_query=${name}`,
    ...overrides,
  };
}

function definitionWith(...names: string[]): PlanDefinition {
  return {
    id: "barbell-strength",
    name: "Synthetic",
    summary: "Synthetic plan",
    days: [
      {
        id: "day-x",
        label: "Day X",
        title: "X",
        focus: "X",
        exercises: names.map((name) => ({ name, sets: 3, reps: 5 })),
      },
    ],
  };
}

describe("enrichPlans", () => {
  it("copies the catalogue fields onto the plan exercise", () => {
    const entry = catalogEntry("Press", {
      movementPattern: "bend",
      muscleGroups: ["hamstrings", "glutes"],
    });

    const [plan] = enrichPlans([definitionWith("Press")], [catalogByName([entry])]);

    expect(plan.days[0].exercises[0]).toEqual({
      name: "Press",
      sets: 3,
      reps: 5,
      muscles: ["hamstrings", "glutes"],
      movement: "bend",
      youtube: entry.videoUrl,
      detailUrl: entry.detailUrl,
    });
  });

  it("prefers the earlier catalogue over the later one", () => {
    const live = catalogByName([catalogEntry("Press", { muscleGroups: ["live"] })]);
    const fallback = catalogByName([catalogEntry("Press", { muscleGroups: ["snapshot"] })]);

    const [plan] = enrichPlans([definitionWith("Press")], [live, fallback]);

    expect(plan.days[0].exercises[0].muscles).toEqual(["live"]);
  });

  it("falls back to a later catalogue for a name the earlier one lacks", () => {
    const live = catalogByName([catalogEntry("Press", { muscleGroups: ["live"] })]);
    const fallback = catalogByName([catalogEntry("Row", { muscleGroups: ["back"] })]);

    const [plan] = enrichPlans([definitionWith("Press", "Row")], [live, fallback]);

    expect(plan.days[0].exercises.map((exercise) => exercise.muscles)).toEqual([
      ["live"],
      ["back"],
    ]);
  });

  it("throws naming the exercise no catalogue contains", () => {
    const live = catalogByName([catalogEntry("Press")]);

    const enrich = () => enrichPlans([definitionWith("Press", "Mystery Lift")], [live, new Map()]);

    expect(enrich).toThrow('No catalogue entry for plan exercise "Mystery Lift"');
  });

  it("leaves the definitions untouched", () => {
    const definition = definitionWith("Press");
    const before = structuredClone(definition);

    enrichPlans([definition], [catalogByName([catalogEntry("Press")])]);

    expect(definition).toEqual(before);
  });
});

function customPlan(overrides: Partial<CustomPlan> = {}): CustomPlan {
  return {
    id: CUSTOM_A,
    name: "Mine",
    updatedAt: "2026-07-22T09:00:00.000Z",
    days: [
      {
        id: CUSTOM_B,
        label: "Push",
        title: "Upper",
        focus: "Chest",
        exercises: [{ name: "Press", sets: 4, reps: 6 }],
      },
    ],
    ...overrides,
  };
}

describe("enrichCustomPlans", () => {
  it("keeps an exercise the catalogue lacks, with a search link and no catalogue fields", () => {
    const [plan] = enrichCustomPlans([customPlan()], new Map());

    expect(plan.days[0].exercises[0]).toEqual({
      name: "Press",
      sets: 4,
      reps: 6,
      muscles: [],
      youtube: youtubeSearchUrl("Press"),
    });
  });

  it("copies the catalogue fields for a known exercise", () => {
    const entry = catalogEntry("Press", { movementPattern: "bend", muscleGroups: ["glutes"] });

    const [plan] = enrichCustomPlans([customPlan()], catalogByName([entry]));

    expect(plan.days[0].exercises[0]).toEqual({
      name: "Press",
      sets: 4,
      reps: 6,
      muscles: ["glutes"],
      movement: "bend",
      youtube: entry.videoUrl,
      detailUrl: entry.detailUrl,
    });
  });

  it("keeps the plan and day identity and filled-in texts", () => {
    const [plan] = enrichCustomPlans([customPlan()], new Map());

    expect(plan).toMatchObject({ id: CUSTOM_A, name: "Mine" });
    expect(plan.days[0]).toMatchObject({ id: CUSTOM_B, label: "Push", title: "Upper" });
  });

  it("shows fallbacks for a blank plan name, day label and day title", () => {
    const blank = customPlan({ name: "  " });
    const blankDay = { ...blank.days[0], label: " ", title: "" };
    const draft = { ...blank, days: [blank.days[0], blankDay] };

    const [plan] = enrichCustomPlans([draft], new Map());

    expect(plan.name).toBe("Untitled plan");
    expect(plan.days[1].label).toBe("Day 2");
    expect(plan.days[1].title).toBe("Untitled day");
  });
});
