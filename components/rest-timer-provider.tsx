"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWakeLock } from "@/lib/use-wake-lock";
import { Minus, Plus, Timer, Volume2, VolumeX, X } from "lucide-react";

// Evidence-aligned default: rests over 60 s carry a small hypertrophy edge, so
// two minutes is a sensible starting point for working sets. Per-rest ±15 s
// covers the rest.
const DEFAULT_REST_SECONDS = 120;
const STEP_SECONDS = 15;
const MAX_REST_SECONDS = 600;
const MUTED_KEY = "rep-track-rest-muted";

type RestTimerContextValue = {
  /** Seconds left, 0 when idle. */
  remaining: number;
  /** True while a rest is counting down. */
  running: boolean;
  /** Start (or restart) a rest; a logged set calls this. */
  start: (seconds?: number) => void;
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer must be used within <RestTimerProvider>");
  return ctx;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  // endsAt is the source of truth (a wall-clock target, drift-free); remaining
  // is derived by the ticking effect. null = idle.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(DEFAULT_REST_SECONDS);
  const [remaining, setRemaining] = useState(0);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(false); // drives the "rest complete" announcement

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const audioRef = useRef<AudioContext | null>(null);

  // Persisted mute preference (localStorage-derived → read on mount).
  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTED_KEY) === "1");
    } catch {
      // Storage blocked — default to unmuted.
    }
  }, []);

  const running = endsAt !== null;
  useWakeLock(running);

  // Lazily create/resume the AudioContext under a user gesture (the tap that
  // logs a set), so the completion beep isn't blocked by autoplay policy.
  const ensureAudio = useCallback(() => {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    } catch {
      // Web Audio unavailable — the timer still works, just silently.
    }
  }, []);

  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    // Two short sine blips — enough to notice, not startle.
    const now = ctx.currentTime;
    for (const offset of [0, 0.3]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    }
  }, []);

  const start = useCallback(
    (seconds = DEFAULT_REST_SECONDS) => {
      ensureAudio();
      setDone(false);
      setDuration(seconds);
      setRemaining(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    },
    [ensureAudio],
  );

  const stop = useCallback(() => {
    setEndsAt(null);
    setRemaining(0);
  }, []);

  const adjust = useCallback((delta: number) => {
    setEndsAt((prev) => {
      if (prev === null) return prev;
      // Keep at least one step on the clock so a −15 s can't end it instantly.
      const next = Math.max(Date.now() + STEP_SECONDS * 1000, prev + delta * 1000);
      return Math.min(next, Date.now() + MAX_REST_SECONDS * 1000);
    });
    setDuration((d) => Math.min(MAX_REST_SECONDS, Math.max(STEP_SECONDS, d + delta)));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal.
      }
      return next;
    });
  }, []);

  // Tick while running; complete when the wall-clock target passes.
  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (Date.now() >= endsAt) {
        setEndsAt(null);
        setRemaining(0);
        setDone(true);
        if (!mutedRef.current) {
          beep();
          navigator.vibrate?.([200, 100, 200]);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, beep]);

  const value = useMemo(() => ({ remaining, running, start }), [remaining, running, start]);

  const progress = duration > 0 ? Math.min(1, remaining / duration) : 0;

  return (
    <RestTimerContext.Provider value={value}>
      {children}

      {running ? (
        <div
          role="timer"
          aria-label={`Rest timer, ${formatClock(remaining)} remaining`}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
                <Timer className="size-4 text-primary" aria-hidden="true" />
                Rest
              </span>
              <span className="flex-1 text-center text-lg font-bold tabular-nums text-card-foreground">
                {formatClock(remaining)}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjust(-STEP_SECONDS)}
                  aria-label="Subtract 15 seconds"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => adjust(STEP_SECONDS)}
                  aria-label="Add 15 seconds"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute rest alert" : "Mute rest alert"}
                  aria-pressed={muted}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {muted ? (
                    <VolumeX className="size-4" aria-hidden="true" />
                  ) : (
                    <Volume2 className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                  Skip
                </button>
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Completion is announced once; the ticking clock stays visual-only. */}
      <output className="sr-only" aria-live="polite">
        {done ? "Rest complete." : ""}
      </output>
    </RestTimerContext.Provider>
  );
}
