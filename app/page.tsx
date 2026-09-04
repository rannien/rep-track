import Link from "next/link";
import { plans } from "@/lib/plans";
import { WorkoutCard } from "@/components/workout-card";
import { ExercisePanelProvider } from "@/components/exercise-panel-provider";
import { LoggingDateProvider } from "@/components/logging-date-provider";
import { PageNav } from "@/components/page-nav";
import { PlanPanels } from "@/components/plan-panels";
import { Dumbbell } from "lucide-react";

export default function Page() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-9">
              <Dumbbell className="size-4 sm:size-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:text-sm">
              Rep Track
            </span>
          </div>
          <PageNav current="plan" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Weekly Training Program
        </h1>
        {/* Plan-neutral: which plan is active is a per-device preference the
            server can't know, so the day and exercise counts live on each
            plan's own line below, inside the reveal boundary. */}
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Log each set with its weight and reps — tap the{" "}
          <span className="font-semibold text-primary">+</span> on a move to start today&apos;s
          session. Every set shows what you lifted last time, so you can chase progressive overload.
        </p>
      </header>

      <LoggingDateProvider>
        <ExercisePanelProvider>
          <PlanPanels
            panels={plans.map((plan) => ({
              id: plan.id,
              content: (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    <span className="font-semibold text-foreground">{plan.name}</span> —{" "}
                    {plan.days.length} training days,{" "}
                    {plan.days.reduce((sum, day) => sum + day.exercises.length, 0)} exercises.{" "}
                    <Link href="/settings" className="font-medium text-primary hover:underline">
                      Change plan
                    </Link>
                  </p>
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    {plan.days.map((day) => (
                      <WorkoutCard key={day.id} day={day} />
                    ))}
                  </div>
                </div>
              ),
            }))}
          />
        </ExercisePanelProvider>
      </LoggingDateProvider>

      <footer className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground sm:mt-12 sm:text-sm">
        Keep your form clean and rest enough between sets.
      </footer>
    </main>
  );
}
