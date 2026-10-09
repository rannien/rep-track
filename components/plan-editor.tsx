"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CircleCheck, Plus, Trash2 } from "lucide-react";
import { MuscleBadge } from "@/components/badges";
import { ConfirmButton } from "@/components/confirm-button";
import { ExercisePicker } from "@/components/exercise-picker";
import { usePlan } from "@/components/plan-provider";
import { useSessions } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { catalogByName } from "@/lib/catalog";
import {
  type CustomPlan,
  MAX_DAY_EXERCISES,
  MAX_DAY_FOCUS_LENGTH,
  MAX_DAY_LABEL_LENGTH,
  MAX_DAY_TITLE_LENGTH,
  MAX_PLAN_DAYS,
  MAX_PLAN_NAME_LENGTH,
  MAX_SETS,
  addDay,
  addExercise,
  isUsable,
  moveDay,
  moveExercise,
  newCustomId,
  removeDay,
  removeExercise,
  renamePlan,
  setExerciseTarget,
  updateDayTexts,
} from "@/lib/custom-plans";
import { MAX_REPS } from "@/lib/sessions";
import type { PlanDay } from "@/lib/workouts";

const fieldClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

export function PlanEditor({ plan, onBack }: { plan: CustomPlan; onBack: () => void }) {
  const { updateCustomPlan, planId, setPlanId } = usePlan();
  const nameId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const usable = isUsable(plan);
  const edit = (change: (current: CustomPlan) => CustomPlan) => updateCustomPlan(plan.id, change);

  // The list view this replaced held focus; give screen readers the new context.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Editing {plan.name.trim() || "Untitled plan"}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All plans
        </Button>
        {planId === plan.id ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <CircleCheck className="size-4" aria-hidden="true" />
            Active plan
          </span>
        ) : (
          <Button type="button" size="sm" disabled={!usable} onClick={() => setPlanId(plan.id)}>
            Use this plan
          </Button>
        )}
      </div>

      <label htmlFor={nameId} className="flex flex-col gap-1 sm:max-w-sm">
        <span className={labelClass}>Plan name</span>
        <input
          id={nameId}
          type="text"
          value={plan.name}
          maxLength={MAX_PLAN_NAME_LENGTH}
          placeholder="Untitled plan"
          onChange={(e) => edit((current) => renamePlan(current, e.target.value))}
          className={fieldClass}
        />
      </label>

      {!usable ? (
        <p className="text-xs text-muted-foreground">
          Give every day at least one exercise to use this plan. Changes save automatically.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Changes save automatically.</p>
      )}

      <ol className="flex flex-col gap-4">
        {plan.days.map((day, index) => (
          <li key={day.id}>
            <DayEditor
              day={day}
              position={index}
              dayCount={plan.days.length}
              onEdit={(change) => edit((current) => change(current, day.id))}
              onRemoved={() => headingRef.current?.focus()}
            />
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={plan.days.length >= MAX_PLAN_DAYS}
        onClick={() => edit((current) => addDay(current, newCustomId()))}
      >
        <Plus aria-hidden="true" />
        {plan.days.length >= MAX_PLAN_DAYS ? `Up to ${MAX_PLAN_DAYS} days` : "Add a day"}
      </Button>
    </div>
  );
}

type DayChange = (plan: CustomPlan, dayId: string) => CustomPlan;

function DayEditor({
  day,
  position,
  dayCount,
  onEdit,
  onRemoved,
}: {
  day: PlanDay;
  position: number;
  dayCount: number;
  onEdit: (change: DayChange) => void;
  onRemoved: () => void;
}) {
  const { catalog } = usePlan();
  const { sessions } = useSessions();
  const [picking, setPicking] = useState(false);
  const fieldId = useId();
  const addExercisesRef = useRef<HTMLButtonElement>(null);
  const catalogMap = useMemo(() => catalogByName(catalog), [catalog]);
  const taken = useMemo(() => new Set(day.exercises.map((exercise) => exercise.name)), [day]);
  const loggedSessions = sessions.filter((session) => session.dayId === day.id).length;
  const dayName = day.label.trim() || `Day ${position + 1}`;

  return (
    <section
      aria-label={dayName}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr]">
        <label htmlFor={`${fieldId}-label`} className="flex flex-col gap-1">
          <span className={labelClass}>Label</span>
          <input
            id={`${fieldId}-label`}
            type="text"
            value={day.label}
            maxLength={MAX_DAY_LABEL_LENGTH}
            placeholder={`Day ${position + 1}`}
            onChange={(e) =>
              onEdit((plan, dayId) => updateDayTexts(plan, dayId, { label: e.target.value }))
            }
            className={fieldClass}
          />
        </label>
        <label htmlFor={`${fieldId}-title`} className="flex flex-col gap-1">
          <span className={labelClass}>Title</span>
          <input
            id={`${fieldId}-title`}
            type="text"
            value={day.title}
            maxLength={MAX_DAY_TITLE_LENGTH}
            placeholder="e.g. Upper body"
            onChange={(e) =>
              onEdit((plan, dayId) => updateDayTexts(plan, dayId, { title: e.target.value }))
            }
            className={fieldClass}
          />
        </label>
        <label htmlFor={`${fieldId}-focus`} className="flex flex-col gap-1">
          <span className={labelClass}>Focus</span>
          <input
            id={`${fieldId}-focus`}
            type="text"
            value={day.focus}
            maxLength={MAX_DAY_FOCUS_LENGTH}
            placeholder="e.g. Chest, back & arms"
            onChange={(e) =>
              onEdit((plan, dayId) => updateDayTexts(plan, dayId, { focus: e.target.value }))
            }
            className={fieldClass}
          />
        </label>
      </div>

      {day.exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {day.exercises.map((exercise, index) => {
            const entry = catalogMap.get(exercise.name);
            return (
              <li key={exercise.name} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">{exercise.name}</span>
                  {entry ? (
                    entry.muscleGroups.map((muscle) => <MuscleBadge key={muscle} label={muscle} />)
                  ) : (
                    <span className="text-xs text-destructive">
                      Not in the WWWorkout catalogue — consider replacing it.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <NumberField
                    label="Sets"
                    value={exercise.sets}
                    max={MAX_SETS}
                    onCommit={(sets) =>
                      onEdit((plan, dayId) =>
                        setExerciseTarget(plan, dayId, exercise.name, { sets }),
                      )
                    }
                  />
                  <NumberField
                    label="Reps"
                    value={exercise.reps}
                    max={MAX_REPS}
                    onCommit={(reps) =>
                      onEdit((plan, dayId) =>
                        setExerciseTarget(plan, dayId, exercise.name, { reps }),
                      )
                    }
                  />
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      aria-label={`Move ${exercise.name} up`}
                      onClick={() =>
                        onEdit((plan, dayId) => moveExercise(plan, dayId, exercise.name, -1))
                      }
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === day.exercises.length - 1}
                      aria-label={`Move ${exercise.name} down`}
                      onClick={() =>
                        onEdit((plan, dayId) => moveExercise(plan, dayId, exercise.name, 1))
                      }
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${exercise.name}`}
                      onClick={() => {
                        onEdit((plan, dayId) => removeExercise(plan, dayId, exercise.name));
                        addExercisesRef.current?.focus();
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {picking ? (
        <ExercisePicker
          catalog={catalog}
          taken={taken}
          full={day.exercises.length >= MAX_DAY_EXERCISES}
          onAdd={(name) => onEdit((plan, dayId) => addExercise(plan, dayId, name))}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={addExercisesRef}
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={picking}
          onClick={() => setPicking(!picking)}
        >
          {picking ? (
            "Done adding"
          ) : (
            <>
              <Plus aria-hidden="true" />
              Add exercises
            </>
          )}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={position === 0}
            aria-label={`Move ${dayName} up`}
            onClick={() => onEdit((plan, dayId) => moveDay(plan, dayId, -1))}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={position === dayCount - 1}
            aria-label={`Move ${dayName} down`}
            onClick={() => onEdit((plan, dayId) => moveDay(plan, dayId, 1))}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <ConfirmButton
            label={`Remove ${dayName}`}
            confirmLabel="Remove day"
            warning={
              loggedSessions > 0
                ? `${loggedSessions} logged ${loggedSessions === 1 ? "session stays" : "sessions stay"} in History but will no longer belong to a plan.`
                : undefined
            }
            onConfirm={() => {
              onEdit((plan, dayId) => removeDay(plan, dayId));
              onRemoved();
            }}
          />
        </div>
      </div>
    </section>
  );
}

// Keeps its own draft so the field can be cleared while typing; commits on blur or Enter.
function NumberField({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    const parsed = Number.parseInt(draft ?? "", 10);
    if (Number.isInteger(parsed)) onCommit(parsed);
    setDraft(null);
  }

  return (
    <label htmlFor={id} className="flex w-20 flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={fieldClass}
      />
    </label>
  );
}
