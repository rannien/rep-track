"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import {
  type ExerciseEntry,
  type LoggedSet,
  type Session,
  entryVolume,
  formatSessionDate,
  formatSet,
  parseRepsInput,
  parseWeightInput,
  sessionStats,
} from "@/lib/sessions";
import { type WeightUnit, formatVolume, weightFromKg } from "@/lib/units";
import { cn } from "@/lib/utils";
import { CalendarPlus, Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";

export function SessionHistory() {
  const { hydrated, sessions } = useSessions();

  // Same hydration gate as DaySessionSummary: nothing localStorage-derived
  // until mounted, so the server render and first client render match.
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
          No sessions logged yet.
        </p>
        <Link href="/" className="font-medium text-primary hover:underline">
          Go to the plan and log your first set →
        </Link>
      </div>
    );
  }

  // Most recent first — same ordering idiom as lastEntryForExercise.
  const sorted = sessions.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt));

  return <SessionList sessions={sorted} />;
}

function SessionList({ sessions }: { sessions: Session[] }) {
  // Single-open accordion, starting with the most recent session. A button +
  // animated grid (same smooth grid-template-rows disclosure as the exercise
  // logging panels) rather than native <details>, which snaps open instantly.
  const [openId, setOpenId] = useState<string | null>(sessions[0].id);

  return (
    <ul className="flex flex-col gap-3 sm:gap-4">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          open={openId === session.id}
          onToggle={() => setOpenId((prev) => (prev === session.id ? null : session.id))}
          onOpen={() => setOpenId(session.id)}
        />
      ))}
    </ul>
  );
}

function SessionCard({
  session,
  open,
  onToggle,
  onOpen,
}: {
  session: Session;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { removeSession } = useSessions();
  const { unit } = useUnit();
  // Edit mode swaps the compact set chips for rows with per-set controls;
  // reading stays chip-dense by default.
  const [editing, setEditing] = useState(false);

  const { sets, reps, volume } = sessionStats(session);
  const stats = [
    { label: "Sets", value: sets.toLocaleString() },
    { label: "Reps", value: reps.toLocaleString() },
    { label: "Volume", value: formatVolume(volume, unit) },
  ];
  const panelId = `history-panel-${session.id}`;
  const dateLabel = formatSessionDate(session.startedAt);

  return (
    <li>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 pr-3 sm:pr-4">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-5"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                  {session.dayLabel}
                </span>
                <span className="text-sm font-semibold text-card-foreground">{dateLabel}</span>
              </div>
              <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1">
                    <dt>{stat.label}</dt>
                    <dd className="font-semibold tabular-nums text-card-foreground">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-pressed={editing}
              aria-label={`Edit session ${dateLabel}`}
              onClick={() => {
                setEditing((prev) => !prev);
                if (!editing) onOpen();
              }}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                editing
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
              )}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            {/* Undoable via the global toast, so no blocking confirm. */}
            <button
              type="button"
              aria-label={`Delete session ${dateLabel}`}
              onClick={() => removeSession(session.id)}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          id={panelId}
          inert={!open}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <ul className="divide-y divide-border border-t border-border">
              {session.entries.map((entry) => (
                <SessionEntry
                  key={entry.exercise}
                  session={session}
                  entry={entry}
                  unit={unit}
                  editing={editing}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </li>
  );
}

function SessionEntry({
  session,
  entry,
  unit,
  editing,
}: {
  session: Session;
  entry: ExerciseEntry;
  unit: WeightUnit;
  editing: boolean;
}) {
  const exerciseVolume = entryVolume(entry);

  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-card-foreground">{entry.exercise}</span>
        <span className="text-xs text-muted-foreground">
          Volume{" "}
          <span className="font-semibold tabular-nums text-card-foreground">
            {formatVolume(exerciseVolume, unit)}
          </span>
        </span>
      </div>
      {editing ? (
        <EditableSets session={session} entry={entry} unit={unit} />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entry.sets.map((set, i) => (
            <span
              key={set.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary py-0.5 pl-1 pr-2 text-xs tabular-nums text-secondary-foreground"
            >
              <span className="inline-flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              {formatSet(set, unit)}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// Edit-mode set list: the same inline weight/reps correction idiom as the
// logging panel on the plan page, against any past session.
function EditableSets({
  session,
  entry,
  unit,
}: {
  session: Session;
  entry: ExerciseEntry;
  unit: WeightUnit;
}) {
  const { removeSet, updateSet } = useSessions();
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const editWeightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSetId !== null) {
      editWeightInputRef.current?.focus({ preventScroll: true });
    }
  }, [editingSetId]);

  const editRepsValue = parseRepsInput(editReps);
  const editWeightValue = parseWeightInput(editWeight, unit);
  const canSave = editRepsValue !== null && editWeightValue !== null;

  function beginEdit(set: LoggedSet) {
    setEditingSetId(set.id);
    setEditWeight(set.weight > 0 ? String(weightFromKg(set.weight, unit)) : "");
    setEditReps(String(set.reps));
  }

  function saveEdit(setNumber: number) {
    if (editingSetId === null || editRepsValue === null || editWeightValue === null) return;
    updateSet(session.id, entry.exercise, editingSetId, {
      reps: editRepsValue,
      weight: editWeightValue,
    });
    setAnnouncement(
      `Set ${setNumber} updated: ${formatSet({ reps: editRepsValue, weight: editWeightValue }, unit)}.`,
    );
    setEditingSetId(null);
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {entry.sets.map((set, i) => {
        const isEditing = editingSetId === set.id;
        return (
          <li
            key={set.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5"
          >
            {isEditing ? (
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm tabular-nums text-card-foreground">
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
                      if (/^[0-9.,]*$/.test(e.target.value)) setEditWeight(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(i + 1);
                      if (e.key === "Escape") setEditingSetId(null);
                    }}
                    placeholder="0"
                    className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      if (/^\d*$/.test(e.target.value)) setEditReps(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(i + 1);
                      if (e.key === "Escape") setEditingSetId(null);
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
                <span className="font-medium">{formatSet(set, unit)}</span>
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveEdit(i + 1)}
                    disabled={!canSave}
                    aria-label={`Save changes to set ${i + 1}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSetId(null)}
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
                    onClick={() => beginEdit(set)}
                    aria-label={`Edit set ${i + 1}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSet(session.id, entry.exercise, set.id)}
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
      {/* Edits are announced once; the visible list already updated. */}
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </ul>
  );
}
