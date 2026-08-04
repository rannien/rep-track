"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSessions } from "@/components/session-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Session,
  entryVolume,
  formatSessionDate,
  formatSet,
  sessionStats,
} from "@/lib/sessions";
import { useSetSearchParams } from "@/lib/use-set-search-params";
import { distinctDays } from "@/lib/workouts";
import { cn } from "@/lib/utils";
import { CalendarPlus, ChevronDown } from "lucide-react";

// Doubles as the Suspense fallback on /history (useSearchParams suspends
// during the static prerender), so it must match the real layout's heights.
export function SessionHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

export function SessionHistory() {
  const { hydrated, sessions } = useSessions();
  // The day filter lives in the URL (same idiom as the stats controls) so
  // reload and back/forward reproduce it; unknown values fall back to all.
  const searchParams = useSearchParams();
  const setSearchParams = useSetSearchParams();

  // Same hydration gate as DaySessionSummary: nothing localStorage-derived
  // until mounted, so the server render and first client render match.
  if (!hydrated) {
    return <SessionHistorySkeleton />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
          No sessions logged yet.
        </p>
        <Link href="/" className="font-medium text-primary hover:underline">
          Go to the plan and log your first set →
        </Link>
      </div>
    );
  }

  // Most recent first — same ordering idiom as lastEntryForExercise.
  const sorted = sessions.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Only day ids actually present are selectable, so the URL param is guarded
  // against unknown values and a chosen day can never yield an empty list.
  const days = distinctDays(sorted);
  const dayParam = searchParams.get("day");
  const activeDay = days.some((day) => day.id === dayParam) ? dayParam : null;
  const filtered =
    activeDay === null ? sorted : sorted.filter((session) => session.dayId === activeDay);
  const dayItems = [
    { value: null as string | null, label: "All days" },
    ...days.map((day) => ({ value: day.id, label: day.label })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {days.length > 1 && (
        <div className="flex w-fit flex-col gap-1">
          <Label
            htmlFor="history-day-filter"
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Day
          </Label>
          <Select
            items={dayItems}
            value={activeDay}
            onValueChange={(day) => setSearchParams({ day })}
          >
            <SelectTrigger id="history-day-filter" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayItems.map((item) => (
                <SelectItem key={item.value ?? "all"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Keyed by the filter so the most recent session of the new selection
          starts open instead of keeping a stale openId. */}
      <SessionList key={activeDay ?? "all"} sessions={filtered} />
    </div>
  );
}

function SessionList({ sessions }: { sessions: Session[] }) {
  // Single-open accordion, starting with the most recent session. A button +
  // animated grid (same smooth grid-template-rows disclosure as the exercise
  // logging panels) rather than native <details>, which snaps open instantly.
  const [openId, setOpenId] = useState<string | null>(sessions[0].id);

  return (
    <ul className="flex flex-col gap-3 sm:gap-4">
      {sessions.map((session) => {
        const { sets, reps, volume } = sessionStats(session);
        const stats = [
          { label: "Sets", value: sets.toLocaleString() },
          { label: "Reps", value: reps.toLocaleString() },
          { label: "Volume", value: volume > 0 ? `${volume.toLocaleString()} kg` : "—" },
        ];
        const open = openId === session.id;
        const panelId = `history-panel-${session.id}`;
        return (
          <li key={session.id}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId((prev) => (prev === session.id ? null : session.id))}
                className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                      {session.dayLabel}
                    </span>
                    <span className="text-sm font-semibold text-card-foreground">
                      {formatSessionDate(session.startedAt)}
                    </span>
                  </div>
                  <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {stats.map((stat) => (
                      <div key={stat.label} className="flex items-center gap-1">
                        <dt>{stat.label}</dt>
                        <dd className="font-semibold tabular-nums text-card-foreground">
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    open && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>

              <div
                id={panelId}
                inert={!open}
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-in-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <ul className="divide-y divide-border border-t border-border">
                    {session.entries.map((entry) => {
                      const exerciseVolume = entryVolume(entry);
                      return (
                        <li
                          key={entry.exercise}
                          className="flex flex-col gap-1.5 px-4 py-3 sm:px-5"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="text-sm font-medium text-card-foreground">
                              {entry.exercise}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Volume{" "}
                              <span className="font-semibold tabular-nums text-card-foreground">
                                {exerciseVolume > 0 ? `${exerciseVolume.toLocaleString()} kg` : "—"}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.sets.map((set, i) => (
                              <span
                                key={set.id}
                                className="inline-flex items-center gap-1.5 rounded-md bg-secondary py-0.5 pl-1 pr-2 text-xs tabular-nums text-secondary-foreground"
                              >
                                <span className="inline-flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                                  {i + 1}
                                </span>
                                {formatSet(set)}
                              </span>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
