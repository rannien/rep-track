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

// Tick labels get tight at 375px; the tooltip carries the full name.
function truncateName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17).trimEnd()}…` : name;
}

function TotalsTooltip({ active, payload }: TooltipContentProps) {
  const totals = payload?.[0]?.payload as ExerciseTotals | undefined;
  if (!active || !totals) return null;
  return (
    <ChartTooltipFrame title={totals.exercise}>
      <ChartTooltipRow label="Sessions" value={formatCount(totals.sessions)} />
      <ChartTooltipRow label="Sets" value={formatCount(totals.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(totals.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(totals.volume)} />
    </ChartTooltipFrame>
  );
}

// Lifetime totals per exercise as horizontal bars, sorted by the active
// metric (the sorting lives in exerciseTotals). Single series → single hue,
// no legend.
export function ExerciseTotalsChart({
  data,
  metric,
}: {
  data: ExerciseTotals[];
  metric: StatsMetric;
}) {
  return (
    <div className="w-full tabular-nums" style={{ height: data.length * 36 + 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
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
            fill="var(--chart-1)"
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
