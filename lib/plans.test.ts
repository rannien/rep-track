import { describe, expect, it } from "vitest";
import snapshot from "./catalog-snapshot.json";
import {
  type CatalogExercise,
  DEFAULT_WWWORKOUT_URL,
  catalogByName,
  parseCatalog,
} from "./catalog";
import {
  DEFAULT_PLAN_ID,
  PLAN_INIT_SCRIPT,
  type PlanDefinition,
  type PlanId,
  enrichPlans,
  knownDays,
  parseStoredPlanId,
  planById,
  planDefinitions,
} from "./plans";

const snapshotCatalog = catalogByName(
  parseCatalog(snapshot, new URL(DEFAULT_WWWORKOUT_URL).origin),
);
const shippedPlans = () => enrichPlans(planDefinitions, [snapshotCatalog]);

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

  it("rejects prototype keys rather than resolving them", () => {
    // The reason the parser is an array lookup and not an object index.
    for (const raw of ["__proto__", "constructor", "toString", "valueOf"]) {
      expect(parseStoredPlanId(raw)).toBeNull();
    }
  });
});

describe("plan registry", () => {
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
