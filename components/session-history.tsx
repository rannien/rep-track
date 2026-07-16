"use client";

import { useState } from "react";
import { useSessions } from "@/components/session-provider";
import {
  type Session,
  entryVolume,
  formatSessionDate,
  formatSet,
  sessionStats,
} from "@/lib/sessions";
import { CalendarPlus, ChevronDown } from "lucide-react";
import Link from "next/link";

export function SessionHistory() {
  const { hydrated, sessions } = useSessions();

  // Same hydration gate as DaySessionSummary: nothing localStorage-derived
  // until mounted, so the server render and first client render match.
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
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

  return <SessionList sessions={sorted} />;
}

function SessionList({ sessions }: { sessions: Session[] }) {
  // Controlled <details> so the most recent session starts expanded and the
  // open/closed state survives re-renders. Keyed by session id.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([sessions[0].id]));

  function toggle(id: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-3 sm:gap-4">
      {sessions.map((session) => {
        const { sets, reps, volume } = sessionStats(session);
        const stats = [
          { label: "Sets", value: sets.toLocaleString() },
          { label: "Reps", value: reps.toLocaleString() },
          { label: "Volume", value: volume > 0 ? `${volume.toLocaleString()} kg` : "—" },
        ];
        return (
          <li key={session.id}>
            <details
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              open={openIds.has(session.id)}
              onToggle={(e) => toggle(session.id, e.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden">
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
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>

              <ul className="flex flex-col gap-2.5 border-t border-border p-4 sm:p-5">
                {session.entries.map((entry) => {
                  const exerciseVolume = entryVolume(entry);
                  return (
                    <li key={entry.exercise} className="flex flex-col gap-1.5">
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
            </details>
          </li>
        );
      })}
    </ul>
  );
}
