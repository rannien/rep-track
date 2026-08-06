"use client";

import { useRestTimer } from "@/components/rest-timer-provider";
import { cn } from "@/lib/utils";
import { Timer, Volume2, VolumeX } from "lucide-react";

// The lengths offered as one-tap defaults; all sit above the 60 s the
// hypertrophy evidence favours.
const PRESETS = [60, 90, 120, 150, 180];

function presetLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes}:${rest.toString().padStart(2, "0")}`;
}

const chipBase =
  "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

// Rest-timer preferences: the default countdown length a logged set starts, and
// whether the completion alert makes a sound. Both persist via the provider.
export function RestTimerSettings() {
  const { defaultSeconds, setDefaultSeconds, muted, setMuted, testSound } = useRestTimer();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
          <Timer className="size-4 text-primary" aria-hidden="true" />
          Rest timer
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The countdown that starts when you log a set — you can still nudge it ±15s mid-rest.
        </p>
      </div>

      <fieldset>
        <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Default length
        </legend>
        {/* Margin, not fieldset gap: a legend is not a flex item, so gap
            between it and the options never applies. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((seconds) => {
            const active = defaultSeconds === seconds;
            return (
              <label
                key={seconds}
                className={cn(
                  chipBase,
                  active
                    ? "border border-primary bg-primary text-primary-foreground"
                    : "border border-border bg-card text-card-foreground hover:bg-secondary/60",
                )}
              >
                <input
                  type="radio"
                  name="rest-default"
                  className="sr-only"
                  checked={active}
                  onChange={() => setDefaultSeconds(seconds)}
                />
                {presetLabel(seconds)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-pressed={!muted}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {muted ? (
            <VolumeX className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4 text-primary" aria-hidden="true" />
          )}
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button
          type="button"
          onClick={testSound}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Test sound
        </button>
      </div>
    </section>
  );
}
