"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Search, Trophy } from "lucide-react";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import { formatSessionDate, personalRecords } from "@/lib/sessions";
import { formatWeight } from "@/lib/units";

// All-time personal records: per exercise, the heaviest set actually lifted —
// real weights from the log, no estimates.
export function PrBoard() {
  const { hydrated, sessions } = useSessions();
  const { unit } = useUnit();
  // Ephemeral quick filter — deliberately not URL state: it narrows a list
  // the user is looking at, it isn't a view worth bookmarking.
  const [query, setQuery] = useState("");

  // Same hydration gate as SessionHistory: nothing localStorage-derived until
  // mounted.
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  const records = personalRecords(sessions);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
          No records yet — they appear once you log a set with a weight.
        </p>
        <Link href="/" className="font-medium text-primary hover:underline">
          Go to the plan and log your first set →
        </Link>
      </div>
    );
  }

  // Filter after ranking, so a filtered row keeps its true all-time rank.
  const needle = query.trim().toLowerCase();
  const matches = records
    .map((record, index) => ({ record, rank: index + 1 }))
    .filter(({ record }) => record.exercise.toLowerCase().includes(needle));

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block w-full sm:max-w-xs">
        <span className="sr-only">Search exercises</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {matches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No records match &quot;{query.trim()}&quot;.
        </p>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <ol className="flex flex-col divide-y divide-border">
            {matches.map(({ record, rank }) => (
              <li key={record.exercise} className="flex items-center gap-3 py-2.5">
                <span
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {rank}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-card-foreground">
                    {record.exercise}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSessionDate(record.startedAt)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-card-foreground">
                    <Trophy
                      className="size-3.5 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    {formatWeight(record.set.weight, unit)}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    × {record.set.reps} reps
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Screen-reader echo of the filter outcome; visual users see the list change. */}
      <output className="sr-only" aria-live="polite">
        {needle !== "" ? `${matches.length} of ${records.length} records shown.` : ""}
      </output>
    </div>
  );
}
