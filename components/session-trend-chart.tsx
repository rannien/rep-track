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
import type { DayLegendEntry } from "@/lib/workouts";

// The plotted points carry their display unit *and* their day color, so the
// tooltip needs no props beyond what recharts injects — defining
// TrendTooltip inside the component to close over a color map instead would
// hand recharts a new component identity on every render.
type DisplayPoint = SessionPoint & { unit: WeightUnit; color: string };

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as DisplayPoint | undefined;
  if (!active || !point) return null;
  return (
    <ChartTooltipFrame
      title={
        <>
          <SeriesSwatch color={point.color} />
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
// to the display unit before plotting so the axis and tooltip agree. `days`
// comes from dayLegend() in the caller and spans every shipped plan, so a
// session logged under the non-active plan gets its own hue and legend entry;
// only a day no plan knows reads as neutral.
export function SessionTrendChart({
  data,
  metric,
  unit,
  days,
}: {
  data: SessionPoint[];
  metric: StatsMetric;
  unit: WeightUnit;
  days: DayLegendEntry[];
}) {
  const colors = new Map(days.map((day) => [day.id, day.color]));
  const plotted: DisplayPoint[] = data.map((point) => ({
    ...point,
    volume: volumeFromKg(point.volume, unit),
    unit,
    color: colors.get(point.dayId) ?? "var(--muted-foreground)",
  }));

  return (
    <div className="flex flex-col gap-2">
      {days.length > 1 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {days.map((day) => (
            <li key={day.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SeriesSwatch color={day.color} />
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
                <Cell key={point.sessionId} fill={point.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
