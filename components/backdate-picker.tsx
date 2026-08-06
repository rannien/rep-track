"use client";

import { useId } from "react";
import { useLoggingDate } from "@/components/logging-date-provider";
import { parseDateKeyParam, todayKey } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { CalendarClock, X } from "lucide-react";

// Lets a day card log into a past calendar date (backfilling a missed
// workout). A native date input on purpose: the platform picker is the best
// mobile UX and costs zero bundle weight on the plan page — the popover +
// calendar stack the stats filter uses would add ~45 kB gzipped here.
export function BackdatePicker({ dayId }: { dayId: string }) {
  const { dateFor, isBackdated, setDateFor } = useLoggingDate();
  const inputId = useId();

  const backdated = isBackdated(dayId);
  const today = todayKey();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-center gap-1.5 font-medium",
          backdated ? "text-primary" : "text-muted-foreground",
        )}
      >
        <CalendarClock className="size-3.5" aria-hidden="true" />
        {backdated ? "Logging for" : "Log a past day"}
      </label>
      <input
        id={inputId}
        type="date"
        value={backdated ? dateFor(dayId) : ""}
        max={today}
        onChange={(e) => {
          // The picker enforces max, but a typed value can still be junk or
          // in the future — anything invalid falls back to today.
          const next = parseDateKeyParam(e.target.value);
          setDateFor(dayId, next !== null && next <= today ? next : null);
        }}
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {backdated && (
        <button
          type="button"
          onClick={() => setDateFor(dayId, null)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
          Back to today
        </button>
      )}
    </div>
  );
}
