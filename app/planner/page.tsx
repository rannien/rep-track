import { Suspense } from "react";
import { PageNav } from "@/components/page-nav";
import { Planner, PlannerSkeleton } from "@/components/planner";

export default function PlannerPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="planner" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Planner
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Build your own training plans from the WWWorkout exercise catalogue: add training days,
          pick exercises, and set the sets and reps. Your plans stay on this device and travel in
          your backup file.
        </p>
      </header>

      {/* useSearchParams (the selected plan) suspends during the static prerender. */}
      <Suspense fallback={<PlannerSkeleton />}>
        <Planner />
      </Suspense>
    </main>
  );
}
