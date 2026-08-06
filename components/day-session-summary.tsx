"use client";

import { BackdatePicker } from "@/components/backdate-picker";
import { useLoggingDate } from "@/components/logging-date-provider";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import { dayProgress } from "@/lib/adherence";
import { formatDateKey, sessionStats } from "@/lib/sessions";
import { formatVolume } from "@/lib/units";
import type { WorkoutDay } from "@/lib/workouts";
import { CalendarCheck, CalendarPlus, CircleCheck } from "lucide-react";

export function DaySessionSummary({ day }: { day: WorkoutDay }) {
  const { hydrated, sessionOn } = useSessions();
  const { dateFor, isBackdated } = useLoggingDate();
  const { unit } = useUnit();

  // Avoid SSR/client mismatch: nothing localStorage-derived until hydrated.
  if (!hydrated) {
    return <div className="mx-3 mb-3 h-9 sm:mx-4" aria-hidden="true" />;
  }

  const dateKey = dateFor(day.id);
  const backdated = isBackdated(day.id);
  const session = sessionOn(day.id, dateKey);
  const sessionTitle = backdated ? `Session — ${formatDateKey(dateKey)}` : "Today's session";

  if (!session) {
    return (
      <div className="mx-3 mb-3 flex flex-col gap-2 sm:mx-4">
        <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <CalendarPlus className="size-3.5" aria-hidden="true" />
          {backdated ? (
            <>
              No sets logged for {formatDateKey(dateKey)} — tap{" "}
              <span className="font-semibold text-primary">+</span> on an exercise to backfill that
              session.
            </>
          ) : (
            <>
              No sets logged today — tap <span className="font-semibold text-primary">+</span> on an
              exercise to start today&apos;s session.
            </>
          )}
        </p>
        <BackdatePicker dayId={day.id} />
      </div>
    );
  }

  const { sets, reps, volume } = sessionStats(session);
  const stats = [
    { label: "Sets", value: sets.toLocaleString() },
    { label: "Reps", value: reps.toLocaleString() },
    { label: "Volume", value: formatVolume(volume, unit) },
  ];
  const progress = dayProgress(day, session);

  return (
    <div className="mx-3 mb-3 flex flex-col gap-2 sm:mx-4">
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
          <CalendarCheck className="size-3.5 text-primary" aria-hidden="true" />
          {sessionTitle}
          {progress.targetSets > 0 ? (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold tabular-nums text-card-foreground">
              {progress.done ? (
                <>
                  <CircleCheck className="size-3.5 text-primary" aria-hidden="true" />
                  Workout complete · {progress.completedSets}/{progress.targetSets} sets
                </>
              ) : (
                <>
                  {progress.completedSets}/{progress.targetSets} sets
                </>
              )}
            </span>
          ) : null}
        </span>
        {progress.targetSets > 0 ? (
          // Decorative: the counter above carries the information.
          <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress.fraction * 100}%` }}
            />
          </div>
        ) : null}
        <dl className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="text-sm font-bold tabular-nums text-card-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <BackdatePicker dayId={day.id} />
    </div>
  );
}
