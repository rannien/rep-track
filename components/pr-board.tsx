"use client";

import Link from "next/link";
import { CalendarPlus, Trophy } from "lucide-react";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import { formatSessionDate, personalRecords } from "@/lib/sessions";
import { formatWeight } from "@/lib/units";

// All-time personal records: per exercise, the heaviest set actually lifted —
// real weights from the log, no estimates.
export function PrBoard() {
  const { hydrated, sessions } = useSessions();
  const { unit } = useUnit();

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

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <ol className="flex flex-col divide-y divide-border">
        {records.map((record, i) => (
          <li key={record.exercise} className="flex items-center gap-3 py-2.5">
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
              aria-hidden="true"
            >
              {i + 1}
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
  );
}
