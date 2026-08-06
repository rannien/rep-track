"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Exercise } from "@/lib/workouts";
import { exerciseProgress } from "@/lib/adherence";
import { MovementBadge, MuscleBadge } from "@/components/badges";
import { useExercisePanel } from "@/components/exercise-panel-provider";
import { useRestTimer } from "@/components/rest-timer-provider";
import { useSessions } from "@/components/session-provider";
import {
  bestOneRepMaxForExercise,
  bestOneRepMaxSet,
  entryBestOneRepMax,
  formatDate,
  formatOneRepMax,
  formatSet,
  lastEntryForExercise,
  parseRepsInput,
  parseWeightInput,
} from "@/lib/sessions";
import {
  Play,
  Plus,
  CircleCheck,
  Dumbbell,
  Pencil,
  Trash2,
  Check,
  History,
  Trophy,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Scroll the row above the on-screen keyboard. window.innerHeight ignores the
// keyboard, so measure against the visual viewport instead; never push the top
// of the row out of view.
function scrollAboveKeyboard(el: HTMLElement) {
  const viewport = window.visualViewport;
  const visibleTop = viewport?.offsetTop ?? 0;
  const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
  const rect = el.getBoundingClientRect();
  const distance = Math.min(rect.bottom + 12 - visibleBottom, rect.top - visibleTop);
  if (distance <= 0) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: distance, behavior: reduceMotion ? "auto" : "smooth" });
}

export function ExerciseRow({
  exercise,
  dayId,
  dayLabel,
}: {
  exercise: Exercise;
  dayId: string;
  dayLabel: string;
}) {
  const { hydrated, sessions, todaySession, addSet, removeSet, updateSet } = useSessions();
  const { start: startRest } = useRestTimer();
  const { openPanel, setOpenPanel } = useExercisePanel();
  const panelKey = `${dayId}:${exercise.name}`;
  const open = openPanel === panelKey;
  const [reps, setReps] = useState(String(exercise.reps));
  const [weight, setWeight] = useState("");
  // Inline correction of an already-logged set. Keyed by set id, so if the set
  // disappears (deleted in another tab) the row just renders in display mode.
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editAnnouncement, setEditAnnouncement] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);
  const editWeightInputRef = useRef<HTMLInputElement>(null);
  // Set id whose pencil button should regain focus once edit mode exits.
  const pencilFocusRef = useRef<string | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);

  const session = todaySession(dayId);
  const todaysSets = session?.entries.find((e) => e.exercise === exercise.name)?.sets ?? [];
  const progress = exerciseProgress(session, exercise);
  // `sessions` is referentially stable across keystrokes (reps/weight are
  // local state), so the full-history scan only reruns when a set changes.
  const last = useMemo(
    () => lastEntryForExercise(sessions, exercise.name, session?.id),
    [sessions, exercise.name, session?.id],
  );

  // Estimated-1RM progression: the best from every prior session (the bar to
  // beat) vs. the best of today's sets. Beating it marks a personal record.
  const priorBest = useMemo(
    () => bestOneRepMaxForExercise(sessions, exercise.name, session?.id),
    [sessions, exercise.name, session?.id],
  );
  const todayBest = entryBestOneRepMax({ exercise: exercise.name, sets: todaysSets });
  // Only celebrate beating an established best — the first-ever entry sets the
  // baseline silently rather than firing a hollow PR on every new exercise.
  const isPR = priorBest > 0 && todayBest > priorBest;
  const currentBest = Math.max(priorBest, todayBest);
  // The badge shows the set actually lifted (e.g. "100 kg × 8"), not the
  // extrapolated 1RM — that estimate lives in the tooltip instead.
  const prSet = isPR ? bestOneRepMaxSet(todaysSets) : null;

  // The set you're about to log, and what you did for that same set last time.
  const nextSetNumber = todaysSets.length + 1;
  const target = last?.entry.sets[todaysSets.length];

  useEffect(() => {
    if (target) {
      setReps(String(target.reps));
      setWeight(target.weight > 0 ? String(target.weight) : "");
    } else {
      setReps(String(exercise.reps));
      setWeight("");
    }
  }, [target, exercise.reps]);

  useEffect(() => {
    if (open) {
      // The panel is still collapsed here — scrolling happens once the expand
      // transition finishes, so keep the browser from scrolling to the
      // pre-expansion position.
      weightInputRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // The Save button is disabled while these are null, so an invalid input
  // can never end in a silent no-op.
  const repsValue = parseRepsInput(reps);
  const weightValue = parseWeightInput(weight);
  const canSave = repsValue !== null && weightValue !== null;

  const editRepsValue = parseRepsInput(editReps);
  const editWeightValue = parseWeightInput(editWeight);
  const canSaveEdit = editRepsValue !== null && editWeightValue !== null;

  useEffect(() => {
    if (editingSetId !== null) {
      editWeightInputRef.current?.focus({ preventScroll: true });
      if (rowRef.current) scrollAboveKeyboard(rowRef.current);
    }
  }, [editingSetId]);

  function beginEdit(log: { id: string; reps: number; weight: number }) {
    setEditingSetId(log.id);
    setEditWeight(log.weight > 0 ? String(log.weight) : "");
    setEditReps(String(log.reps));
  }

  function cancelEdit() {
    pencilFocusRef.current = editingSetId;
    setEditingSetId(null);
  }

  // Unlike handleAdd this never starts the rest timer — no set was performed,
  // one was corrected.
  function saveEdit(setNumber: number) {
    if (!session || editingSetId === null || editRepsValue === null || editWeightValue === null) {
      return;
    }
    updateSet(session.id, exercise.name, editingSetId, {
      reps: editRepsValue,
      weight: editWeightValue,
    });
    setEditAnnouncement(
      `Set ${setNumber} updated: ${formatSet({ reps: editRepsValue, weight: editWeightValue })}.`,
    );
    pencilFocusRef.current = editingSetId;
    setEditingSetId(null);
  }

  function handleAdd() {
    if (repsValue === null || weightValue === null) return;
    addSet({ id: dayId, label: dayLabel }, exercise.name, {
      reps: repsValue,
      weight: weightValue,
    });
    // Kick off the rest countdown from the same tap that logs the set — this is
    // the user gesture the completion beep needs to satisfy autoplay policy.
    startRest();
    setReps(String(repsValue));
    setWeight("");
    weightInputRef.current?.focus();
  }

  return (
    <li
      ref={rowRef}
      className={cn(
        "flex flex-col p-3 border-l-2 transition-all duration-300 sm:p-4",
        open
          ? "border-l-primary bg-primary/5 dark:bg-primary/10"
          : "border-l-transparent hover:bg-secondary/40",
      )}
    >
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
            {hydrated && progress.logged > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary",
                  progress.met ? "bg-primary/15 font-semibold" : "bg-primary/10 font-medium",
                )}
              >
                {progress.met ? (
                  <CircleCheck className="size-3" aria-hidden="true" />
                ) : (
                  <Dumbbell className="size-3" aria-hidden="true" />
                )}
                {progress.logged}/{progress.target} sets
              </span>
            ) : null}
            {hydrated && prSet ? (
              <span
                title={`Estimated 1RM ${formatOneRepMax(todayBest)}`}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                <Trophy className="size-3" aria-hidden="true" />
                New PR · {formatSet(prSet)}
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
            onClick={() => setOpenPanel(open ? null : panelKey)}
            aria-expanded={open}
            aria-label={`Log a set for ${exercise.name}`}
            className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus
              className={cn(
                "size-4 transition-transform duration-300 ease-in-out",
                open ? "rotate-45" : "rotate-0",
              )}
              aria-hidden="true"
            />
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

      <div
        inert={!open}
        onTransitionEnd={(e) => {
          if (
            open &&
            e.target === e.currentTarget &&
            e.propertyName === "grid-template-rows" &&
            rowRef.current
          ) {
            scrollAboveKeyboard(rowRef.current);
          }
        }}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-3">
            {/* Standing estimated 1RM benchmark for this exercise */}
            {hydrated && currentBest > 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="size-3.5 text-primary" aria-hidden="true" />
                  Best est. 1RM
                </span>
                <span className="font-semibold tabular-nums text-card-foreground">
                  {formatOneRepMax(currentBest)}
                </span>
              </div>
            ) : null}

            {/* Sets logged in today's session */}
            {hydrated && todaysSets.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {todaysSets.map((log, i) => {
                  const ref = last?.entry.sets[i];
                  const editing = editingSetId === log.id;
                  return (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
                    >
                      {editing ? (
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm tabular-nums text-card-foreground">
                          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                            {i + 1}
                          </span>
                          <label>
                            <span className="sr-only">Weight in kilograms for set {i + 1}</span>
                            <input
                              ref={editWeightInputRef}
                              type="text"
                              inputMode="decimal"
                              value={editWeight}
                              onChange={(e) => {
                                if (/^[0-9.,]*$/.test(e.target.value)) {
                                  setEditWeight(e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(i + 1);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="0"
                              className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </label>
                          <span className="shrink-0 text-xs text-muted-foreground">kg ×</span>
                          <label>
                            <span className="sr-only">Reps for set {i + 1}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editReps}
                              onChange={(e) => {
                                if (/^\d*$/.test(e.target.value)) {
                                  setEditReps(e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(i + 1);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </label>
                        </span>
                      ) : (
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
                      )}
                      <span className="flex shrink-0 items-center gap-1">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(i + 1)}
                              disabled={!canSaveEdit}
                              aria-label={`Save changes to set ${i + 1}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              aria-label={`Cancel editing set ${i + 1}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <X className="size-3.5" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              ref={(el) => {
                                if (el && pencilFocusRef.current === log.id) {
                                  pencilFocusRef.current = null;
                                  el.focus({ preventScroll: true });
                                }
                              }}
                              onClick={() => beginEdit(log)}
                              aria-label={`Edit set ${i + 1}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                session && removeSet(session.id, exercise.name, log.id)
                              }
                              aria-label={`Remove set ${i + 1}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {/* Edits are announced once; the visible set list already updated. */}
            <output className="sr-only" aria-live="polite">
              {editAnnouncement}
            </output>

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
                    ref={weightInputRef}
                    type="text"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9.,]*$/.test(val)) {
                        setWeight(val);
                      }
                    }}
                    placeholder={target && target.weight > 0 ? String(target.weight) : "0"}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Reps
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) {
                        setReps(val);
                      }
                    }}
                    placeholder={target ? String(target.reps) : String(exercise.reps)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canSave}
                  className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
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
        </div>
      </div>
    </li>
  );
}
