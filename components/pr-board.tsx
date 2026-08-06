"use client";

import { Trophy } from "lucide-react";
import { useUnit } from "@/components/unit-provider";
import { type PersonalRecord, formatOneRepMax, formatSessionDate, formatSet } from "@/lib/sessions";

// All-time personal records: per exercise, the logged set with the highest
// estimated 1RM. Deliberately unaffected by the stats date-range filter — a
// record is a record.
export function PrBoard({ records }: { records: PersonalRecord[] }) {
  const { unit } = useUnit();
  if (records.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No records yet — they appear once you log a set with a weight.
      </p>
    );
  }

  return (
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
              {formatSet(record.set, unit)} · {formatSessionDate(record.startedAt)}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-card-foreground">
              <Trophy className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              {formatOneRepMax(record.oneRepMax, unit)}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              est. 1RM
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
