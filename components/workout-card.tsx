import type { WorkoutDay } from "@/lib/workouts"
import { ExerciseRow } from "@/components/exercise-row"
import { DaySessionSummary } from "@/components/day-session-summary"
import { Dumbbell, Layers } from "lucide-react"

export function WorkoutCard({ day }: { day: WorkoutDay }) {
  const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0)
  const totalReps = day.exercises.reduce((sum, e) => sum + e.sets * e.reps, 0)
  const pushCount = day.exercises.filter((e) => e.movement === "push").length
  const pullCount = day.exercises.filter((e) => e.movement === "pull").length

  const stats = [
    { label: "Total Sets", value: String(totalSets) },
    { label: "Total Reps", value: String(totalReps) },
    { label: "Push / Pull", value: `${pushCount} / ${pullCount}` },
  ]

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
            {day.label}
          </span>
          <h2 className="text-lg font-bold tracking-tight text-card-foreground text-balance sm:text-xl">
            {day.title}
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{day.focus}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Dumbbell className="size-3.5 text-primary" aria-hidden="true" />
            {day.exercises.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5 text-primary" aria-hidden="true" />
            {totalSets}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-3"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              {stat.label}
            </span>
            <span className="text-xl font-bold tabular-nums text-card-foreground sm:text-2xl">
              {stat.value}
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
  )
}
