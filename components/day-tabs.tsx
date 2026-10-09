"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLoggingDate } from "@/components/logging-date-provider";
import { useSessions } from "@/components/session-provider";
import { dayProgress, defaultDayId } from "@/lib/adherence";
import { todayKey } from "@/lib/sessions";
import type { WorkoutDay } from "@/lib/workouts";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Before hydration the first day is shown so the server HTML matches;
// afterwards the default comes from the logged sessions.
export function DayTabs({ tabs }: { tabs: { day: WorkoutDay; content: ReactNode }[] }) {
  const { hydrated, sessions } = useSessions();
  const [chosenDayId, setChosenDayId] = useState<string | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const days = tabs.map((tab) => tab.day);
  // A custom plan can lose the chosen day to an edit in another tab.
  const chosen = days.some((day) => day.id === chosenDayId) ? chosenDayId : null;
  const selectedDayId =
    chosen ?? (hydrated ? defaultDayId(days, sessions, todayKey()) : days[0]?.id);

  function select(index: number) {
    const day = days[(index + days.length) % days.length];
    setChosenDayId(day.id);
    tabRefs.current.get(day.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: days.length - 1,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    select(targets[event.key]);
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div
        role="tablist"
        aria-label="Training day"
        className="grid auto-cols-[minmax(6.5rem,1fr)] grid-flow-col gap-1 overflow-x-auto rounded-2xl border border-border bg-secondary p-1"
      >
        {days.map((day, index) => {
          const selected = day.id === selectedDayId;
          return (
            <button
              key={day.id}
              ref={(el) => {
                if (el) tabRefs.current.set(day.id, el);
                else tabRefs.current.delete(day.id);
              }}
              type="button"
              role="tab"
              id={`day-tab-${day.id}`}
              aria-selected={selected}
              aria-controls={`day-panel-${day.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setChosenDayId(day.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-sm font-semibold">
                {day.label}
                {hydrated ? <DayTabProgress day={day} /> : null}
              </span>
              <span className="w-full truncate text-xs">{day.title}</span>
            </button>
          );
        })}
      </div>

      {tabs.map(({ day, content }) => (
        <div
          key={day.id}
          role="tabpanel"
          id={`day-panel-${day.id}`}
          aria-labelledby={`day-tab-${day.id}`}
          hidden={day.id !== selectedDayId}
        >
          {day.id === selectedDayId ? content : null}
        </div>
      ))}
    </div>
  );
}

function DayTabProgress({ day }: { day: WorkoutDay }) {
  const { sessionOn } = useSessions();
  const { dateFor } = useLoggingDate();
  const progress = dayProgress(day, sessionOn(day.id, dateFor(day.id)));

  if (progress.completedSets === 0) return null;
  if (progress.done) {
    return <CircleCheck className="ml-auto size-4 shrink-0 text-primary" aria-label="complete" />;
  }
  return (
    <span className="ml-auto text-xs font-medium tabular-nums">
      {progress.completedSets}/{progress.targetSets}
      <span className="sr-only"> sets</span>
    </span>
  );
}
