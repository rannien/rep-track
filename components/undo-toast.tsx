"use client";

import { useEffect, useRef } from "react";
import { Undo2, X } from "lucide-react";
import { type SetRemoval, formatSet } from "@/lib/sessions";

const UNDO_WINDOW_MS = 6000;

// Snackbar for undoable set deletions, rendered by SessionProvider while any
// removal is pending. Floats above the rest-timer bar and the storage banner
// (both fixed to bottom-0). The countdown restarts on every new delete and
// pauses while hovered or focused, so a keyboard user tabbing to Undo is
// never raced by the timer.
export function UndoToast({
  removals,
  onUndo,
  onExpire,
}: {
  removals: SetRemoval[];
  onUndo: () => void;
  onExpire: () => void;
}) {
  const pausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (pausedRef.current) return;
    timerRef.current = window.setTimeout(() => onExpireRef.current(), UNDO_WINDOW_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [removals]);

  function pause() {
    pausedRef.current = true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function resume() {
    pausedRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onExpireRef.current(), UNDO_WINDOW_MS);
  }

  const latest = removals[removals.length - 1];
  const label =
    removals.length === 1
      ? `Removed set: ${latest.exercise} — ${formatSet(latest.set)}`
      : `Removed ${removals.length} sets`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div
        onMouseEnter={pause}
        onMouseLeave={resume}
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-lg"
      >
        <output className="min-w-0 truncate">{label}</output>
        <button
          type="button"
          onClick={onUndo}
          onFocus={pause}
          onBlur={resume}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Undo2 className="size-4" aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          onClick={onExpire}
          onFocus={pause}
          onBlur={resume}
          aria-label="Dismiss, keep deleted"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
