"use client";

import Link from "next/link";
import { usePlan } from "@/components/plan-provider";
import { PlanView } from "@/components/plan-view";
import { isCustomId } from "@/lib/custom-plans";

export function CustomPlanPanel() {
  const { hydrated, planId, plan } = usePlan();

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-2xl bg-secondary" aria-hidden="true" />;
  }
  if (!isCustomId(planId)) return null;
  if (plan.days.every((day) => day.exercises.length === 0)) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{plan.name}</span> has no exercises yet.
        </p>
        <Link href={`/planner?plan=${planId}`} className="font-medium text-primary hover:underline">
          Add exercises in the planner
        </Link>
      </div>
    );
  }
  // Keyed so switching between custom plans resets the chosen day tab.
  return <PlanView key={plan.id} plan={plan} />;
}
