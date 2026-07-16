import type { WorkoutDay } from "@/lib/workouts";
import { ExerciseRow } from "@/components/exercise-row";
import { DaySessionSummary } from "@/components/day-session-summary";
import { ArrowUpDown, Dumbbell, Layers, Repeat } from "lucide-react";

export function WorkoutCard({ day }: { day: WorkoutDay }) {
  const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
  const totalReps = day.exercises.reduce((sum, e) => sum + e.sets * e.reps, 0);
  const pushCount = day.exercises.filter((e) => e.movement === "push").length;
  const pullCount = day.exercises.filter((e) => e.movement === "pull").length;

  const stats = [
    { label: "Exercises", value: String(day.exercises.length), icon: Dumbbell },
    { label: "Total Sets", value: String(totalSets), icon: Layers },
    { label: "Total Reps", value: String(totalReps), icon: Repeat },
  ];

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-1 border-b border-border bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5">
        <h2 className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          {day.label}
        </h2>
        <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-card-foreground sm:text-xl">
          <ArrowUpDown className="size-4 shrink-0 text-primary sm:size-5" aria-hidden="true" />
          {pushCount} Push / {pullCount} Pull
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">{day.focus}</p>
      </header>

      <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-3"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </span>
            <span className="text-xl font-bold tabular-nums text-card-foreground sm:text-2xl">
              {value}
            </span>
          </div>
        ))}
      </div>

      <DaySessionSummary dayId={day.id} />

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
