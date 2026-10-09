import Link from "next/link";
import { DayTabs } from "@/components/day-tabs";
import { WorkoutCard } from "@/components/workout-card";
import { isCustomId } from "@/lib/custom-plans";
import type { WorkoutPlan } from "@/lib/plans";

// Hook-free, so the server page renders it for shipped plans and CustomPlanPanel on the client.
export function PlanView({ plan }: { plan: WorkoutPlan }) {
  const exerciseCount = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <p className="text-xs text-muted-foreground sm:text-sm">
        <span className="font-semibold text-foreground">{plan.name}</span> — {plan.days.length}{" "}
        training days, {exerciseCount} exercises.{" "}
        <Link href="/settings" className="font-medium text-primary hover:underline">
          Change plan
        </Link>
        {" · "}
        <Link
          href={isCustomId(plan.id) ? `/planner?plan=${plan.id}` : "/planner"}
          className="font-medium text-primary hover:underline"
        >
          {isCustomId(plan.id) ? "Edit plan" : "Build your own"}
        </Link>
      </p>
      <DayTabs
        tabs={plan.days.map((day) => ({
          day,
          content: <WorkoutCard day={day} />,
        }))}
      />
    </div>
  );
}
