"use client";

import { type ComponentProps, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type Session, dateKeyToDate, dateToDateKey, formatDateKey } from "@/lib/sessions";
import { useSetSearchParams } from "@/lib/use-set-search-params";
import { CalendarRange, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

// Day cell with a dot under the number on days that logged a session. The dot
// inherits the text color, so it stays visible when the day is selected and
// the button flips to the primary background.
function WorkoutDayButton({ children, ...props }: ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton {...props}>
      {children}
      {props.modifiers.workout && (
        <span
          className="absolute inset-x-0 bottom-0.5 mx-auto size-1 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
    </CalendarDayButton>
  );
}

// From/to calendar filter for the stats page: one range calendar in a
// popover, with workout days dotted for orientation. Values are date-only
// YYYY-MM-DD strings matching Session.dateKey and live in the URL (?from=&to=)
// so reload and back/forward reproduce the view.
export function DateRangeFilter({
  from,
  to,
  sessions,
}: {
  from: string | null;
  to: string | null;
  sessions: Session[]; // unfiltered history — the dots mark every logged day
}) {
  const setSearchParams = useSetSearchParams();
  const [open, setOpen] = useState(false);
  // The selection being built while the popover is open. The URL — and with
  // it every chart — only updates once the range completes or the popover
  // closes; applying each click live would collapse the stats to a single
  // day after the first click (react-day-picker's first pick is from=to).
  const [pending, setPending] = useState<DateRange | undefined>();

  const { workoutDays, latestDay } = useMemo(() => {
    const keys = [...new Set(sessions.map((s) => s.dateKey))].toSorted();
    return {
      workoutDays: keys.map(dateKeyToDate),
      latestDay: keys.length > 0 ? dateKeyToDate(keys[keys.length - 1]) : undefined,
    };
  }, [sessions]);

  const applied: DateRange | undefined =
    from !== null || to !== null
      ? {
          from: from !== null ? dateKeyToDate(from) : undefined,
          to: to !== null ? dateKeyToDate(to) : undefined,
        }
      : undefined;

  const applyRange = (range: DateRange | undefined) => {
    setSearchParams({
      from: range?.from ? dateToDateKey(range.from) : null,
      to: range?.to ? dateToDateKey(range.to) : null,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPending(applied);
    } else {
      // Dismissing (Esc, outside click) applies whatever was picked — a lone
      // start date becomes an open-ended "from" filter.
      applyRange(pending);
    }
    setOpen(nextOpen);
  };

  const handleSelect = (range: DateRange | undefined, day: Date) => {
    // A click with a complete range starts a new selection — the library's
    // default (dragging the nearest end around) makes ranges impossible to
    // redo without clearing first.
    if (pending?.from === undefined || pending.to !== undefined) {
      setPending({ from: day, to: undefined });
      return;
    }
    setPending(range);
    // Second click completes the range (same-day click = that one day);
    // apply it and get out of the way.
    if (range?.from && range?.to) {
      applyRange(range);
      setOpen(false);
    }
  };

  const label =
    from !== null && to !== null
      ? `${formatDateKey(from)} – ${formatDateKey(to)}`
      : from !== null
        ? `From ${formatDateKey(from)}`
        : to !== null
          ? `Until ${formatDateKey(to)}`
          : "All time";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger render={<Button variant="outline" />}>
          <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
          {label}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={pending}
            onSelect={handleSelect}
            defaultMonth={applied?.from ?? applied?.to ?? latestDay}
            modifiers={{ workout: workoutDays }}
            components={{ DayButton: WorkoutDayButton }}
          />
        </PopoverContent>
      </Popover>
      {(from !== null || to !== null) && (
        <Button variant="ghost" onClick={() => setSearchParams({ from: null, to: null })}>
          <X className="size-4" aria-hidden="true" />
          All time
        </Button>
      )}
    </div>
  );
}
