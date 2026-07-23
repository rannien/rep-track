"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ExerciseTotalsChart } from "@/components/exercise-totals-chart";
import { ExerciseTrendChart } from "@/components/exercise-trend-chart";
import { MetricToggle } from "@/components/metric-toggle";
import { SessionTrendChart } from "@/components/session-trend-chart";
import { useSessions } from "@/components/session-provider";
import {
  type StatsMetric,
  exerciseTotals,
  filterSessionsByDateRange,
  parseDateKeyParam,
  sessionSeries,
  totalStats,
} from "@/lib/sessions";
import { useSetSearchParams } from "@/lib/use-set-search-params";
import { CalendarCheck, CalendarPlus, Dumbbell, Layers, Repeat } from "lucide-react";

// Doubles as the Suspense fallback on /stats (useSearchParams suspends during
// the static prerender), so it must match the real layout's heights.
export function SessionStatsSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

export function SessionStats() {
  const { hydrated, sessions } = useSessions();
  // View state (metric + date range) lives in the URL so reload and
  // back/forward reproduce it; anything invalid falls back to the default.
  const searchParams = useSearchParams();
  const setSearchParams = useSetSearchParams();
  const metric: StatsMetric = searchParams.get("metric") === "reps" ? "reps" : "volume";

  // A hand-edited URL may invert the bounds; reading them swapped keeps the
  // inputs and the filter consistent.
  const fromParam = parseDateKeyParam(searchParams.get("from"));
  const toParam = parseDateKeyParam(searchParams.get("to"));
  const inverted = fromParam !== null && toParam !== null && fromParam > toParam;
  const from = inverted ? toParam : fromParam;
  const to = inverted ? fromParam : toParam;

  const filtered = useMemo(
    () => filterSessionsByDateRange(sessions, from, to),
    [sessions, from, to],
  );
  const totals = useMemo(() => totalStats(filtered), [filtered]);
  const trend = useMemo(() => sessionSeries(filtered), [filtered]);
  const perExercise = useMemo(() => exerciseTotals(filtered, metric), [filtered, metric]);
  const hasBodyweightSets = useMemo(
    () => filtered.some((s) => s.entries.some((e) => e.sets.some((set) => set.weight === 0))),
    [filtered],
  );

  // Same hydration gate as SessionHistory: nothing localStorage-derived until
  // mounted.
  if (!hydrated) {
    return <SessionStatsSkeleton />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
          No sessions logged yet — stats appear after your first workout.
        </p>
        <Link href="/" className="font-medium text-primary hover:underline">
          Go to the plan and log your first set →
        </Link>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        <DateRangeFilter from={from} to={to} sessions={sessions} />
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No sessions in this date range — widen it or switch back to all time.
        </p>
      </div>
    );
  }

  const tiles = [
    { label: "Sessions", value: totals.sessions.toLocaleString(), icon: CalendarCheck },
    { label: "Sets", value: totals.sets.toLocaleString(), icon: Layers },
    { label: "Reps", value: totals.reps.toLocaleString(), icon: Repeat },
    {
      label: "Volume",
      value: totals.volume > 0 ? `${totals.volume.toLocaleString()} kg` : "—",
      icon: Dumbbell,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <DateRangeFilter from={from} to={to} sessions={sessions} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-3"
          >
            <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <MetricToggle value={metric} onChange={(next) => setSearchParams({ metric: next })} />
        {metric === "volume" && hasBodyweightSets && (
          <p className="text-xs text-muted-foreground">
            Sets logged without a weight count as 0 kg volume — switch to Reps to compare them.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-card-foreground">
          {metric === "volume" ? "Volume per session" : "Reps per session"}
        </h2>
        <SessionTrendChart data={trend} metric={metric} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-card-foreground">Total {metric} per exercise</h2>
        <ExerciseTotalsChart data={perExercise} metric={metric} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-card-foreground">Exercise over time</h2>
        <ExerciseTrendChart sessions={filtered} metric={metric} />
      </section>
    </div>
  );
}
