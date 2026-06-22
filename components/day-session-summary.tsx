"use client";

import { useSessions } from "@/components/session-provider";
import { sessionStats } from "@/lib/sessions";
import { CalendarCheck, CalendarPlus } from "lucide-react";

export function DaySessionSummary({ dayId }: { dayId: string }) {
  const { hydrated, todaySession } = useSessions();

  // Avoid SSR/client mismatch: nothing localStorage-derived until hydrated.
  if (!hydrated) {
    return <div className="mx-3 mb-3 h-9 sm:mx-4" aria-hidden="true" />;
  }

  const session = todaySession(dayId);

  if (!session) {
    return (
      <p className="mx-3 mb-3 flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground sm:mx-4">
        <CalendarPlus className="size-3.5" aria-hidden="true" />
        No sets logged today — tap <span className="font-semibold text-primary">+</span> on an
        exercise to start today&apos;s session.
      </p>
    );
  }

  const { sets, reps, volume } = sessionStats(session);
  const stats = [
    { label: "Sets", value: sets.toLocaleString() },
    { label: "Reps", value: reps.toLocaleString() },
    { label: "Volume", value: volume > 0 ? `${volume.toLocaleString()} kg` : "—" },
  ];

  return (
    <div className="mx-3 mb-3 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 sm:mx-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
        <CalendarCheck className="size-3.5 text-primary" aria-hidden="true" />
        Today&apos;s session
      </span>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="text-sm font-bold tabular-nums text-card-foreground">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
