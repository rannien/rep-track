"use client";

import { useSessions } from "@/components/session-provider";
import { sessionSetCount, sessionVolume } from "@/lib/sessions";
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

  const sets = sessionSetCount(session);
  const volume = sessionVolume(session);

  return (
    <div className="mx-3 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs sm:mx-4">
      <CalendarCheck className="size-3.5 text-primary" aria-hidden="true" />
      <span className="font-semibold text-card-foreground">Today&apos;s session</span>
      <span className="text-muted-foreground">
        {sets} {sets === 1 ? "set" : "sets"}
        {volume > 0 ? ` · ${volume.toLocaleString()} kg total volume` : ""}
      </span>
    </div>
  );
}
