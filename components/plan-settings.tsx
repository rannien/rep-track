"use client";

import { usePlan } from "@/components/plan-provider";
import { plans } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

// Active training plan. Before hydration the context reports the default, so
// the selected card may flip to the stored choice after mount — the same
// accepted behavior as ThemeSettings' chips and RestTimerSettings' presets.
//
// Full-width cards rather than the pill chips the other settings use: each
// option needs a name, a sentence and a day/exercise count, which won't fit a
// pill at 375 px.
export function PlanSettings() {
  const { planId, setPlanId } = usePlan();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
          <ClipboardList className="size-4 text-primary" aria-hidden="true" />
          Training plan
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Which routine the plan page shows and logs against.
        </p>
      </div>

      <fieldset>
        <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Plan
        </legend>
        {/* Margin, not fieldset gap: a legend is not a flex item, so gap
            between it and the options never applies. */}
        <div className="mt-2 flex flex-col gap-2">
          {plans.map((plan) => {
            const active = planId === plan.id;
            const exercises = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);
            return (
              <label
                key={plan.id}
                className={cn(
                  // Two-column grid so the dot forms a leading column and the
                  // sub-lines align under the name structurally — no
                  // hand-computed indent to drift when the dot size changes.
                  "grid cursor-pointer grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/60",
                )}
              >
                {/* sr-only is absolutely positioned, so the real radio claims
                    no grid track — the dot beside it carries the visual state. */}
                <input
                  type="radio"
                  name="workout-plan"
                  className="sr-only"
                  checked={active}
                  onChange={() => setPlanId(plan.id)}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-3.5 shrink-0 rounded-full border-2",
                    active ? "border-primary bg-primary" : "border-muted-foreground/50",
                  )}
                />
                <span className="text-sm font-semibold text-card-foreground">{plan.name}</span>
                <span className="col-start-2 text-xs leading-relaxed text-muted-foreground">
                  {plan.summary}
                </span>
                <span className="col-start-2 text-[11px] tabular-nums text-muted-foreground">
                  {plan.days.length} days · {exercises} exercises ·{" "}
                  {plan.days.map((day) => day.label).join(", ")}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Switching plans never deletes or moves anything you&apos;ve logged. Each plan has its own
        training days, so past sessions stay under the day they were logged on — and History, Stats,
        Records and Compare always cover every session, whichever plan is active.
      </p>
    </section>
  );
}
