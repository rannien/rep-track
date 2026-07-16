import Link from "next/link";
import { workouts } from "@/lib/workouts";
import { WorkoutCard } from "@/components/workout-card";
import { ExercisePanelProvider } from "@/components/exercise-panel-provider";
import { Dumbbell, History } from "lucide-react";

export default function Page() {
  const totalExercises = workouts.reduce((sum, day) => sum + day.exercises.length, 0);

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
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          >
            <History className="size-4" aria-hidden="true" />
            History
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Weekly Training Program
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Two training days, {totalExercises} exercises total. Log each set with its weight and reps
          — tap the <span className="font-semibold text-primary">+</span> on a move to start
          today&apos;s session. Every set shows what you lifted last time, so you can chase
          progressive overload.
        </p>
      </header>

      <ExercisePanelProvider>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {workouts.map((day) => (
            <WorkoutCard key={day.id} day={day} />
          ))}
        </div>
      </ExercisePanelProvider>

      <footer className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground sm:mt-12 sm:text-sm">
        Keep your form clean and rest enough between sets.
      </footer>
    </main>
  );
}
