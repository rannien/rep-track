"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartTooltipFrame,
  ChartTooltipRow,
  SeriesSwatch,
  axisTick,
  formatCount,
  formatVolume,
} from "@/components/chart-chrome";
import { type SessionPoint, type StatsMetric, formatDate, formatSessionDate } from "@/lib/sessions";
import { type WeightUnit, volumeFromKg } from "@/lib/units";
import { distinctDays, workouts } from "@/lib/workouts";

// Chart slots follow the plan's day order so a day keeps its color no matter
// which sessions are in view; dayIds outside the current plan share the last
// slot rather than minting new hues. chart-3 is reserved for the
// exercise-scoped charts (ExerciseTotalsChart, ExerciseTrendChart) — if the
// plan grows past two days, move those off chart-3 first.
const dayColors = new Map(workouts.map((day, i) => [day.id, `var(--chart-${i + 1})`]));

function dayColor(dayId: string): string {
  return dayColors.get(dayId) ?? "var(--chart-5)";
}

// The plotted points carry their display unit so the tooltip needs no props
// beyond what recharts injects.
type DisplayPoint = SessionPoint & { unit: WeightUnit };

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as DisplayPoint | undefined;
  if (!active || !point) return null;
  return (
    <ChartTooltipFrame
      title={
        <>
          <SeriesSwatch color={dayColor(point.dayId)} />
          {point.dayLabel} · {formatSessionDate(point.startedAt)}
        </>
      }
    >
      <ChartTooltipRow label="Sets" value={formatCount(point.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(point.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(point.volume, point.unit)} />
    </ChartTooltipFrame>
  );
}

// One bar per logged session, colored by training day. Volumes are converted
// to the display unit before plotting so the axis and tooltip agree.
export function SessionTrendChart({
  data,
  metric,
  unit,
}: {
  data: SessionPoint[];
  metric: StatsMetric;
  unit: WeightUnit;
}) {
  const days = distinctDays(data);
  const plotted: DisplayPoint[] = data.map((point) => ({
    ...point,
    volume: volumeFromKg(point.volume, unit),
    unit,
  }));

  return (
    <div className="flex flex-col gap-2">
      {days.length > 1 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {days.map((day) => (
            <li key={day.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SeriesSwatch color={dayColor(day.id)} />
              {day.label}
            </li>
          ))}
        </ul>
      )}
      <div className="h-64 w-full tabular-nums sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={plotted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={TrendTooltip} />
            <Bar
              dataKey={metric}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              activeBar={{ fillOpacity: 0.85 }}
            >
              {plotted.map((point) => (
                <Cell key={point.sessionId} fill={dayColor(point.dayId)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
