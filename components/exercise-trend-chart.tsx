"use client";

import { useId, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ExercisePoint,
  type Session,
  type StatsMetric,
  exerciseSeries,
  exerciseTotals,
  formatDate,
  formatOneRepMax,
  formatSessionDate,
} from "@/lib/sessions";
import { useSetSearchParams } from "@/lib/use-set-search-params";
import { cn } from "@/lib/utils";
import { workouts } from "@/lib/workouts";

// This chart adds estimated 1RM to volume/reps, so it carries its own metric
// choice rather than the page-level Volume/Reps toggle — 1RM is the natural
// default for a per-exercise progression view.
type ExerciseMetric = StatsMetric | "oneRepMax";

const exerciseMetricOptions: { value: ExerciseMetric; label: string }[] = [
  { value: "oneRepMax", label: "Est. 1RM" },
  { value: "volume", label: "Volume" },
  { value: "reps", label: "Reps" },
];

function isExerciseMetric(value: string | null): value is ExerciseMetric {
  return value === "oneRepMax" || value === "volume" || value === "reps";
}

function ExerciseTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ExercisePoint | undefined;
  if (!active || !point) return null;
  return (
    <ChartTooltipFrame title={`${point.dayLabel} · ${formatSessionDate(point.startedAt)}`}>
      <ChartTooltipRow label="Sets" value={formatCount(point.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(point.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(point.volume)} />
      {point.oneRepMax > 0 && (
        <ChartTooltipRow label="Est. 1RM" value={formatOneRepMax(point.oneRepMax)} />
      )}
    </ChartTooltipFrame>
  );
}

// One exercise's per-session trend — the progressive-overload view. Both the
// exercise (?exercise=…) and the metric (?exmetric=…) live in the URL so
// reload and back/forward reproduce it; only rendered with hydrated, non-empty
// session data, so the top-volume default can be computed from it.
export function ExerciseTrendChart({ sessions }: { sessions: Session[] }) {
  const searchParams = useSearchParams();
  const setSearchParams = useSetSearchParams();
  const metricName = useId();
  const exerciseSelectId = useId();

  const exMetricParam = searchParams.get("exmetric");
  const metric: ExerciseMetric = isExerciseMetric(exMetricParam) ? exMetricParam : "oneRepMax";

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
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex w-fit max-w-full flex-col gap-1">
          <Label
            htmlFor={exerciseSelectId}
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Exercise
          </Label>
          {/* Exercise names double as values, so SelectValue can render the
              raw value without an items map. */}
          <Select value={exercise} onValueChange={(name) => setSearchParams({ exercise: name })}>
            <SelectTrigger id={exerciseSelectId} className="max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workouts.map((day) => (
                <SelectGroup key={day.id}>
                  <SelectLabel>{day.label}</SelectLabel>
                  {day.exercises.map((ex) => (
                    <SelectItem key={ex.name} value={ex.name}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {unplanned.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other</SelectLabel>
                  {unplanned.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="inline-flex w-fit items-center rounded-full border border-border bg-secondary p-0.5">
          <legend className="sr-only">Exercise chart metric</legend>
          {exerciseMetricOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                metric === option.value
                  ? "bg-card text-card-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name={metricName}
                value={option.value}
                checked={metric === option.value}
                onChange={() => setSearchParams({ exmetric: option.value })}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

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
              {/* chart-3 = the exercise-scoped hue, shared with
                  ExerciseTotalsChart — day charts own chart-1/2/5. */}
              <Line
                dataKey={metric}
                type="linear"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--chart-3)", stroke: "var(--card)", strokeWidth: 2 }}
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
