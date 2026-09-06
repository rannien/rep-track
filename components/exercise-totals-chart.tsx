"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { ExerciseTotals, StatsMetric } from "@/lib/sessions";
import { type WeightUnit, volumeFromKg } from "@/lib/units";

// Tick labels get tight at 375px; the tooltip carries the full name.
function truncateName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17).trimEnd()}…` : name;
}

// The plotted rows carry their display unit so the tooltip needs no props
// beyond what recharts injects.
type DisplayTotals = ExerciseTotals & { unit: WeightUnit };

function TotalsTooltip({ active, payload }: TooltipContentProps) {
  const totals = payload?.[0]?.payload as DisplayTotals | undefined;
  if (!active || !totals) return null;
  return (
    <ChartTooltipFrame title={totals.exercise}>
      <ChartTooltipRow label="Sessions" value={formatCount(totals.sessions)} />
      <ChartTooltipRow label="Sets" value={formatCount(totals.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(totals.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(totals.volume, totals.unit)} />
    </ChartTooltipFrame>
  );
}

// Lifetime totals per exercise as horizontal bars, sorted by the active
// metric (the sorting lives in exerciseTotals). Single series → single hue,
// no legend. The hue is chart-3, the one categorical slot that
// DAY_COLOR_SLOTS in lib/workouts.ts deliberately never hands to a training
// day — so the exercise-scoped charts cannot collide with day identity, and
// the hue is validated CVD-distinct from every day color in light and dark
// mode. Adding a plan widens DAY_COLOR_SLOTS, never this slot: days past the
// palette fall back to the neutral instead of claiming chart-3.
export function ExerciseTotalsChart({
  data,
  metric,
  unit,
}: {
  data: ExerciseTotals[];
  metric: StatsMetric;
  unit: WeightUnit;
}) {
  const plotted: DisplayTotals[] = data.map((totals) => ({
    ...totals,
    volume: volumeFromKg(totals.volume, unit),
    unit,
  }));
  return (
    <div className="w-full tabular-nums" style={{ height: data.length * 36 + 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={plotted}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={formatCount}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="exercise"
            width="auto"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={truncateName}
          />
          <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={TotalsTooltip} />
          <Bar
            dataKey={metric}
            fill="var(--chart-3)"
            maxBarSize={20}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            activeBar={{ fillOpacity: 0.85 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
