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
import type { MuscleTotals } from "@/lib/adherence";
import type { StatsMetric } from "@/lib/sessions";
import { type WeightUnit, volumeFromKg } from "@/lib/units";

// The plotted rows carry their display unit so the tooltip needs no props
// beyond what recharts injects.
type DisplayTotals = MuscleTotals & { unit: WeightUnit };

function MuscleTooltip({ active, payload }: TooltipContentProps) {
  const totals = payload?.[0]?.payload as DisplayTotals | undefined;
  if (!active || !totals) return null;
  return (
    <ChartTooltipFrame title={totals.muscle}>
      <ChartTooltipRow label="Sets" value={formatCount(totals.sets)} />
      <ChartTooltipRow label="Reps" value={formatCount(totals.reps)} />
      <ChartTooltipRow label="Volume" value={formatVolume(totals.volume, totals.unit)} />
    </ChartTooltipFrame>
  );
}

// Totals per muscle group as horizontal bars, sorted by the active metric
// (sorting lives in muscleTotals). Single series → single hue; wears chart-3
// like the other aggregate-totals chart — in single-series charts the hue
// carries no meaning, so the exercise/muscle sections stay visually one
// family and the day-identity slots (chart-1/2/5) stay untouched.
export function MuscleTotalsChart({
  data,
  metric,
  unit,
}: {
  data: MuscleTotals[];
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
            dataKey="muscle"
            width="auto"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
          />
          <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={MuscleTooltip} />
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
