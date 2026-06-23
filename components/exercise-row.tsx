"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/workouts";
import { MovementBadge, MuscleBadge } from "@/components/badges";
import { useSessions } from "@/components/session-provider";
import { formatDate, formatSet, lastEntryForExercise } from "@/lib/sessions";
import { Play, Plus, Dumbbell, Trash2, Check, X, History } from "lucide-react";

export function ExerciseRow({
  exercise,
  dayId,
  dayLabel,
}: {
  exercise: Exercise;
  dayId: string;
  dayLabel: string;
}) {
  const { hydrated, sessions, todaySession, addSet, removeSet } = useSessions();
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState(String(exercise.reps));
  const [weight, setWeight] = useState("");

  const session = todaySession(dayId);
  const todaysSets = session?.entries.find((e) => e.exercise === exercise.name)?.sets ?? [];
  const last = lastEntryForExercise(sessions, exercise.name, session?.id);

  // The set you're about to log, and what you did for that same set last time.
  const nextSetNumber = todaysSets.length + 1;
  const target = last?.entry.sets[todaysSets.length];

  function handleAdd() {
    const repsNum = Number.parseInt(reps, 10);
    const weightNum = Number.parseFloat(weight);
    if (!Number.isFinite(repsNum) || repsNum <= 0) return;
    addSet({ id: dayId, label: dayLabel }, exercise.name, {
      reps: repsNum,
      weight: Number.isFinite(weightNum) ? weightNum : 0,
    });
    setReps(String(repsNum));
    setWeight("");
  }

  return (
    <li className="flex flex-col gap-3 p-3 transition-colors hover:bg-secondary/40 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold text-card-foreground">{exercise.name}</h3>
            <MovementBadge movement={exercise.movement} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {exercise.muscles.map((muscle) => (
              <MuscleBadge key={muscle} label={muscle} />
            ))}
            <span className="text-xs font-medium text-muted-foreground">
              {exercise.sets} {"×"} {exercise.reps}
            </span>
            {hydrated && todaysSets.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                <Dumbbell className="size-3" aria-hidden="true" />
                {todaysSets.length} {todaysSets.length === 1 ? "set today" : "sets today"}
              </span>
            ) : null}
          </div>
          {hydrated && last ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <History className="size-3" aria-hidden="true" />
              Last {formatDate(last.session.startedAt)}:{" "}
              {last.entry.sets.map((s) => formatSet(s)).join(", ")}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`Log a set for ${exercise.name}`}
            className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {open ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
          </button>
          <a
            href={exercise.youtube}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Watch ${exercise.name} tutorial on YouTube`}
            className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
          </a>
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-3">
          {/* Sets logged in today's session */}
          {hydrated && todaysSets.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {todaysSets.map((log, i) => {
                const ref = last?.entry.sets[i];
                return (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
                  >
                    <span className="flex items-center gap-2 text-sm tabular-nums text-card-foreground">
                      <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-medium">{formatSet(log)}</span>
                      {ref ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          (last {formatSet(ref)})
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => session && removeSet(session.id, exercise.name, log.id)}
                      aria-label={`Remove set ${i + 1}`}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Add the next set; hint shows the matching set from last time */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-card-foreground">
                Set {nextSetNumber}
              </span>
              {target ? (
                <span className="text-xs text-muted-foreground">
                  Last time: <span className="font-medium text-primary">{formatSet(target)}</span>
                </span>
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Weight (kg)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={target && target.weight > 0 ? String(target.weight) : "0"}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reps
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder={target ? String(target.reps) : String(exercise.reps)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Check className="size-4" aria-hidden="true" />
                Save
              </button>
            </div>
          </div>

          {/* Full breakdown of the previous session for this exercise */}
          {hydrated && last ? (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Last session — {formatDate(last.session.startedAt)}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {last.entry.sets.map((s, i) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary py-0.5 pl-1 pr-2 text-xs tabular-nums text-secondary-foreground"
                  >
                    <span className="inline-flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    {formatSet(s)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No previous sessions yet — log your first set to start your history.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
