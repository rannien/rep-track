"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartTooltipFrame,
  ChartTooltipRow,
  axisTick,
  formatCount,
  formatVolume,
} from "@/components/chart-chrome";
import {
  type ExercisePoint,
  type Session,
  type StatsMetric,
  exerciseSeries,
  exerciseTotals,
  formatDate,
  formatSessionDate,
} from "@/lib/sessions";
import { useSetSearchParams } from "@/lib/use-set-search-params";
import { workouts } from "@/lib/workouts";

function ExerciseTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ExercisePoint | undefined;
  if (!active || !point) return null;
  return (
    <ChartTooltipFrame title={`${point.dayLabel} · ${formatSessionDate(point.startedAt)}`}>
      <ChartTooltipRow label="Sets" value={formatCount(point.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(point.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(point.volume)} />
    </ChartTooltipFrame>
  );
}

// One exercise's per-session trend — the progressive-overload view. The
// selection lives in the URL (?exercise=…) so reload and back/forward
// reproduce it; only rendered with hydrated, non-empty session data, so the
// top-volume default can be computed from it.
export function ExerciseTrendChart({
  sessions,
  metric,
}: {
  sessions: Session[];
  metric: StatsMetric;
}) {
  const searchParams = useSearchParams();
  const setSearchParams = useSetSearchParams();

  // Logged exercises no longer in the plan stay selectable under "Other";
  // `selectable` also guards the URL param against unknown names.
  const { unplanned, selectable, topExercise } = useMemo(() => {
    const planned = new Set(workouts.flatMap((day) => day.exercises.map((e) => e.name)));
    const totals = exerciseTotals(sessions, "volume");
    const offPlan = totals.map((t) => t.exercise).filter((name) => !planned.has(name));
    return {
      unplanned: offPlan,
      selectable: new Set([...planned, ...offPlan]),
      topExercise: totals[0]?.exercise ?? workouts[0].exercises[0].name,
    };
  }, [sessions]);

  const exerciseParam = searchParams.get("exercise");
  const exercise =
    exerciseParam !== null && selectable.has(exerciseParam) ? exerciseParam : topExercise;

  const points = useMemo(() => exerciseSeries(sessions, exercise), [sessions, exercise]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Exercise
        </span>
        <select
          value={exercise}
          onChange={(e) => setSearchParams({ exercise: e.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {workouts.map((day) => (
            <optgroup key={day.id} label={day.label}>
              {day.exercises.map((ex) => (
                <option key={ex.name} value={ex.name}>
                  {ex.name}
                </option>
              ))}
            </optgroup>
          ))}
          {unplanned.length > 0 && (
            <optgroup label="Other">
              {unplanned.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      {points.length === 0 ? (
        <p className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground sm:h-72">
          No sets logged for this exercise yet.
        </p>
      ) : (
        <div className="h-64 w-full tabular-nums sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="startedAt"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                minTickGap={16}
              />
              <YAxis
                width="auto"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={formatCount}
                allowDecimals={false}
              />
              <Tooltip cursor={{ stroke: "var(--border)" }} content={ExerciseTooltip} />
              <Line
                dataKey={metric}
                type="linear"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
