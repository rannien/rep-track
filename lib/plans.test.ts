import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_ID,
  PLAN_INIT_SCRIPT,
  type PlanId,
  knownDays,
  parseStoredPlanId,
  planById,
  plans,
} from "./plans";

// The registry is hand-edited data whose identifiers are load-bearing: a plan
// id is a stored preference value, and a day id keys every logged session.
// These invariants are what a typo would silently break, and none of them is
// checkable by the type system.

describe("parseStoredPlanId", () => {
  it("accepts every id this build ships", () => {
    for (const plan of plans) {
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
    expect(plans.length).toBeGreaterThanOrEqual(2);
    for (const plan of plans) {
      expect(plan.id).not.toBe("");
      expect(plan.name).not.toBe("");
      expect(plan.summary).not.toBe("");
      expect(plan.days.length).toBeGreaterThan(0);
    }
  });

  it("keeps plan ids unique", () => {
    const ids = plans.map((plan) => plan.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves the default plan id", () => {
    expect(planById(DEFAULT_PLAN_ID).id).toBe(DEFAULT_PLAN_ID);
  });

  it("keeps day ids unique across every plan, not just within one", () => {
    // A session keys on (dayId, dateKey) alone, so two plans sharing a day id
    // would silently merge their histories.
    const ids = plans.flatMap((plan) => plan.days.map((day) => day.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps day labels unique across every plan", () => {
    // The trend-chart legend and the /stats exercise picker show labels from
    // both plans side by side, so a duplicate label would be ambiguous there.
    const labels = plans.flatMap((plan) => plan.days.map((day) => day.label));

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("planById", () => {
  it("round-trips every id in the registry", () => {
    for (const plan of plans) {
      expect(planById(plan.id)).toBe(plan);
    }
  });

  it("throws on an id no plan claims", () => {
    expect(() => planById("nonexistent" as PlanId)).toThrow(/Unknown plan id/);
  });
});

describe("knownDays", () => {
  it("puts the active plan's days first, in plan order", () => {
    for (const plan of plans) {
      const active = plan.days.map((day) => day.id);

      expect(
        knownDays(plan.id)
          .slice(0, active.length)
          .map((day) => day.id),
      ).toEqual(active);
    }
  });

  it("includes every day of every plan exactly once", () => {
    const all = plans.flatMap((plan) => plan.days.map((day) => day.id));

    for (const plan of plans) {
      const known = knownDays(plan.id).map((day) => day.id);

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
    for (const plan of plans) {
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
    for (const raw of [null, "", ...plans.map((plan) => plan.id), "nope", "__proto__", " x"]) {
      const attributes = runScript(raw);
      const applied = attributes.length > 0 ? attributes[0][1] : DEFAULT_PLAN_ID;

      expect(applied).toBe(parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID);
    }
  });
});
