import type { WorkoutDay } from "@/lib/workouts";
import { ExerciseRow } from "@/components/exercise-row";
import { DaySessionSummary } from "@/components/day-session-summary";
import { Target } from "lucide-react";

export function WorkoutCard({ day }: { day: WorkoutDay }) {
  const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
  const totalReps = day.exercises.reduce((sum, e) => sum + e.sets * e.reps, 0);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-1 border-b border-border bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5">
        <h2 className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          {day.label}
        </h2>
        {/* The day's own name, not a push/pull tally: that counted only two
            of the four movement patterns, so a squat- or hinge-led day read
            as having fewer exercises than it has. Each row still carries its
            own MovementBadge. */}
        <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-card-foreground sm:text-xl">
          <Target className="size-4 shrink-0 text-primary sm:size-5" aria-hidden="true" />
          {day.title}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">{day.focus}</p>
      </header>

      <p className="px-4 py-3 text-xs tabular-nums text-muted-foreground sm:px-5 sm:text-sm">
        {day.exercises.length} exercises · {totalSets} sets · {totalReps} reps
      </p>

      <DaySessionSummary day={day} />

      <ul className="divide-y divide-border border-t border-border">
        {day.exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.name}
            exercise={exercise}
            dayId={day.id}
            dayLabel={day.label}
          />
        ))}
      </ul>
    </section>
  );
}
