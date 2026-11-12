"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { type Exercise, movementLabels, muscleLabel } from "@/lib/workouts";
import { exerciseProgress } from "@/lib/adherence";
import { useExercisePanel } from "@/components/exercise-panel-provider";
import { useLoggingDate } from "@/components/logging-date-provider";
import { useRestTimer } from "@/components/rest-timer-provider";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import { weightFromKg } from "@/lib/units";
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
  repeatableSet,
} from "@/lib/sessions";
import {
  Play,
  ChevronDown,
  Plus,
  CircleCheck,
  Dumbbell,
  Pencil,
  Trash2,
  Check,
  Trophy,
  TrendingUp,
  X,
  BookOpen,
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

const panelLinkClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ExerciseRow({
  exercise,
  dayId,
  dayLabel,
}: {
  exercise: Exercise;
  dayId: string;
  dayLabel: string;
}) {
  const { hydrated, sessions, sessionOn, addSet, removeSet, updateSet } = useSessions();
  const { start: startRest } = useRestTimer();
  const { unit } = useUnit();
  const { dateFor, isBackdated } = useLoggingDate();
  const { openPanel, setOpenPanel } = useExercisePanel();
  const panelKey = `${dayId}:${exercise.name}`;
  const open = openPanel === panelKey;
  const [reps, setReps] = useState(String(exercise.reps));
  const [weight, setWeight] = useState("");
  // Two implements at once (a dumbbell per hand) — the set counts double.
  const [double, setDouble] = useState(false);
  // Inline correction of an already-logged set. Keyed by set id, so if the set
  // disappears (deleted in another tab) the row just renders in display mode.
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editDouble, setEditDouble] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);
  const editWeightInputRef = useRef<HTMLInputElement>(null);
  // Set id whose pencil button takes focus on the next render — after an edit
  // exits, or when a neighbouring set is removed.
  const pencilFocusRef = useRef<string | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);

  // The date this row logs into — today, unless the day card was backdated.
  const activeDate = dateFor(dayId);
  const backdated = isBackdated(dayId);
  const session = sessionOn(dayId, activeDate);
  const todaysSets = session?.entries.find((e) => e.exercise === exercise.name)?.sets ?? [];
  const progress = exerciseProgress(session, exercise);
  const targetsLine = [
    ...exercise.muscles.map(muscleLabel),
    ...(exercise.movement ? [movementLabels[exercise.movement]] : []),
  ].join(" · ");
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
  // The badge shows the set actually lifted (e.g. "100 kg × 8"), not the estimated 1RM.
  const prSet = isPR ? bestOneRepMaxSet(todaysSets) : null;

  // The set you're about to log, and what you did for that same set last time.
  const nextSetNumber = todaysSets.length + 1;
  const target = last?.entry.sets[todaysSets.length];
  const repeatable = repeatableSet(last?.entry.sets, todaysSets);

  useEffect(() => {
    if (target) {
      setReps(String(target.reps));
      setWeight(target.weight > 0 ? String(weightFromKg(target.weight, unit)) : "");
      setDouble(target.double === true);
    } else {
      setReps(String(exercise.reps));
      setWeight("");
      // double deliberately untouched: with no last-time reference the best
      // guess for the next set is whatever this session is already doing.
    }
  }, [target, exercise.reps, unit]);

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
  const weightValue = parseWeightInput(weight, unit);
  const canSave = repsValue !== null && weightValue !== null;

  const editRepsValue = parseRepsInput(editReps);
  const editWeightValue = parseWeightInput(editWeight, unit);
  const canSaveEdit = editRepsValue !== null && editWeightValue !== null;

  useEffect(() => {
    if (editingSetId !== null) {
      editWeightInputRef.current?.focus({ preventScroll: true });
      if (rowRef.current) scrollAboveKeyboard(rowRef.current);
    }
  }, [editingSetId]);

  function beginEdit(log: { id: string; reps: number; weight: number; double?: boolean }) {
    setEditingSetId(log.id);
    setEditWeight(log.weight > 0 ? String(weightFromKg(log.weight, unit)) : "");
    setEditReps(String(log.reps));
    setEditDouble(log.double === true);
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
      double: editDouble,
    });
    setAnnouncement(
      `Set ${setNumber} updated: ${formatSet(
        { reps: editRepsValue, weight: editWeightValue, double: editDouble },
        unit,
      )}.`,
    );
    pencilFocusRef.current = editingSetId;
    setEditingSetId(null);
  }

  function handleRemove(index: number) {
    if (!session) return;
    const neighbour = todaysSets[index + 1] ?? todaysSets[index - 1];
    if (neighbour && neighbour.id !== editingSetId) {
      pencilFocusRef.current = neighbour.id;
    } else {
      weightInputRef.current?.focus();
    }
    setAnnouncement(`Set ${index + 1} removed. Undo available.`);
    removeSet(session.id, exercise.name, todaysSets[index].id);
  }

  function logSet(set: { reps: number; weight: number; double?: boolean }) {
    addSet({ id: dayId, label: dayLabel }, exercise.name, set, activeDate);
    // This tap is the user gesture the completion beep needs (autoplay policy);
    // a backfilled set is data entry, not training, so it gets no countdown.
    if (!backdated) startRest();
    setAnnouncement(`Set ${nextSetNumber} logged: ${formatSet(set, unit)}.`);
  }

  function handleAdd() {
    if (repsValue === null || weightValue === null) return;
    logSet({ reps: repsValue, weight: weightValue, double });
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
      <div className="relative flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="leading-snug font-semibold text-card-foreground">{exercise.name}</h3>
          {targetsLine ? <p className="text-xs text-muted-foreground">{targetsLine}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
            {hydrated && repeatable ? (
              <button
                type="button"
                onClick={() => logSet(repeatable)}
                className="relative z-10 inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium text-foreground tabular-nums transition-colors after:absolute after:-inset-x-1 after:-top-2 after:-bottom-3 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus className="size-3.5 text-primary" aria-hidden="true" />
                {formatSet(repeatable, unit)}
                <span className="sr-only">{`, log as set ${nextSetNumber} of ${exercise.name}`}</span>
              </button>
            ) : null}
            {hydrated && progress.logged > 0 ? (
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs text-primary",
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
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-500/15 px-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Trophy className="size-3" aria-hidden="true" />
                New PR · {formatSet(prSet, unit)}
              </span>
            ) : null}
          </div>
        </div>

        <p className="inline-flex min-w-16 shrink-0 items-baseline justify-center rounded-lg bg-primary/10 px-2 py-1 text-lg leading-none font-bold text-primary tabular-nums dark:bg-primary/15">
          <span aria-hidden="true">
            {exercise.sets}
            <span className="mx-1 text-sm font-semibold">{"×"}</span>
            {exercise.reps}
          </span>
          <span className="sr-only">
            {`${exercise.sets} ${exercise.sets === 1 ? "set" : "sets"} of ${exercise.reps} ${exercise.reps === 1 ? "rep" : "reps"}`}
          </span>
        </p>

        {/* The ::after overlay stretches this button over the whole header, so
            the row itself is the tap target. */}
        <button
          type="button"
          onClick={() => setOpenPanel(open ? null : panelKey)}
          aria-expanded={open}
          aria-label={`Log a set for ${exercise.name}`}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none after:absolute after:-inset-1.5 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          <ChevronDown
            className={cn(
              "size-5 transition-transform duration-300 ease-in-out",
              open ? "rotate-180 text-primary" : "rotate-0",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Outside the inert panel so a repeatable-set log is announced while collapsed. */}
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>

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
            <div className="flex flex-wrap gap-2">
              <a
                href={exercise.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className={panelLinkClass}
              >
                <Play className="size-3.5 fill-current" aria-hidden="true" />
                Video
                <span className="sr-only">
                  {`: ${exercise.name} tutorial on YouTube (opens in a new tab)`}
                </span>
              </a>
              {exercise.detailUrl ? (
                <a
                  href={exercise.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={panelLinkClass}
                >
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  Guide
                  <span className="sr-only">
                    {`: ${exercise.name} in WWWorkout (opens in a new tab)`}
                  </span>
                </a>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="flex items-center gap-2 text-xs font-semibold text-card-foreground">
                  Set {nextSetNumber}
                  <button
                    type="button"
                    onClick={() => setDouble((prev) => !prev)}
                    aria-pressed={double}
                    aria-label="Two dumbbells — counts double"
                    className={cn(
                      "inline-flex h-6 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      double
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    ×2
                  </button>
                </span>
                {target ? (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    Last time:{" "}
                    <span className="font-medium text-primary">{formatSet(target, unit)}</span>
                  </span>
                ) : null}
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Weight ({unit})
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                    }}
                    placeholder={
                      target && target.weight > 0 ? String(weightFromKg(target.weight, unit)) : "0"
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base tabular-nums text-card-foreground outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring"
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                    }}
                    placeholder={target ? String(target.reps) : String(exercise.reps)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base tabular-nums text-card-foreground outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring"
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

            {hydrated && todaysSets.length > 0 ? (
              <ul aria-label="Sets logged today, newest first" className="flex flex-col gap-1.5">
                {todaysSets
                  .map((log, i) => {
                    const ref = last?.entry.sets[i];
                    const editing = editingSetId === log.id;
                    return (
                      <li
                        key={log.id}
                        className={cn(
                          "rounded-lg border border-border bg-card px-3",
                          // Editing lays out as two rows (inputs, then ×2 +
                          // actions) — one line can't fit it all at 375px.
                          editing
                            ? "flex flex-col gap-2 py-2"
                            : "flex items-center justify-between gap-2 py-1.5",
                        )}
                      >
                        {editing ? (
                          <span className="flex items-center gap-2 text-sm tabular-nums text-card-foreground">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                              {i + 1}
                            </span>
                            <label>
                              <span className="sr-only">
                                Weight in {unit === "kg" ? "kilograms" : "pounds"} for set {i + 1}
                              </span>
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
                                className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-base tabular-nums text-card-foreground outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </label>
                            <span className="shrink-0 text-xs text-muted-foreground">{unit} ×</span>
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
                                className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-base tabular-nums text-card-foreground outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setEditDouble((prev) => !prev)}
                              aria-pressed={editDouble}
                              aria-label={`Two dumbbells for set ${i + 1} — counts double`}
                              className={cn(
                                "inline-flex h-7 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                editDouble
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-muted-foreground hover:bg-secondary/60",
                              )}
                            >
                              ×2
                            </button>
                          </span>
                        ) : (
                          <span className="flex min-w-0 items-center gap-2 text-sm tabular-nums text-card-foreground">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                              {i + 1}
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-medium">
                              {formatSet(log, unit)}
                            </span>
                            {ref ? (
                              // Truncates rather than wrapping the row — the
                              // primary value always stays on one line.
                              <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                                (last {formatSet(ref, unit)})
                              </span>
                            ) : null}
                          </span>
                        )}
                        {editing ? (
                          <span className="flex items-center justify-end gap-1">
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
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1">
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
                              onClick={() => handleRemove(i)}
                              aria-label={`Remove set ${i + 1}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })
                  .toReversed()}
              </ul>
            ) : null}

            {hydrated && currentBest > 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="size-3.5 text-primary" aria-hidden="true" />
                  Best est. 1RM
                </span>
                <span className="font-semibold tabular-nums text-card-foreground">
                  {formatOneRepMax(currentBest, unit)}
                </span>
              </div>
            ) : null}

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
                      {formatSet(s, unit)}
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
