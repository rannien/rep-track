"use client";

import { useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { MovementBadge, MuscleBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { type CatalogExercise, MOVEMENTS } from "@/lib/catalog";
import { type Movement, movementLabels, muscleLabel } from "@/lib/workouts";

const MAX_RESULTS = 30;

const fieldClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function ExercisePicker({
  catalog,
  taken,
  full,
  onAdd,
}: {
  catalog: CatalogExercise[];
  /** Names already in the day — shown, but not addable twice. */
  taken: ReadonlySet<string>;
  full: boolean;
  onAdd: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [movement, setMovement] = useState<Movement | "">("");
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const searchId = useId();
  const muscleId = useId();
  const movementId = useId();

  const muscles = useMemo(
    () => [...new Set(catalog.flatMap((exercise) => exercise.muscleGroups))].toSorted(),
    [catalog],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
      .filter(
        (exercise) =>
          (needle === "" || exercise.name.toLowerCase().includes(needle)) &&
          (muscle === "" || exercise.muscleGroups.includes(muscle)) &&
          (movement === "" || exercise.movementPattern === movement),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [catalog, query, muscle, movement]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <label htmlFor={searchId} className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            maxLength={100}
            placeholder="e.g. press"
            onChange={(e) => setQuery(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label htmlFor={muscleId} className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Muscle
          </span>
          <select
            id={muscleId}
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
            className={fieldClass}
          >
            <option value="">Any</option>
            {muscles.map((name) => (
              <option key={name} value={name}>
                {muscleLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={movementId} className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Movement
          </span>
          <select
            id={movementId}
            value={movement}
            onChange={(e) => setMovement(MOVEMENTS.find((value) => value === e.target.value) ?? "")}
            className={fieldClass}
          >
            <option value="">Any</option>
            {MOVEMENTS.map((value) => (
              <option key={value} value={value}>
                {movementLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {matches.length === 0
          ? "No exercise matches."
          : `${matches.length} ${matches.length === 1 ? "match" : "matches"}${matches.length > MAX_RESULTS ? ` — showing the first ${MAX_RESULTS}` : ""}.`}
        {full ? " This day is full." : ""}
        {lastAdded ? ` Added ${lastAdded}.` : ""}
      </p>

      <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
        {matches.slice(0, MAX_RESULTS).map((exercise) => {
          const added = taken.has(exercise.name);
          return (
            <li key={exercise.name} className="flex items-center gap-3 p-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {exercise.name}
                  <MovementBadge movement={exercise.movementPattern} />
                </span>
                <span className="flex flex-wrap gap-1">
                  {exercise.muscleGroups.map((name) => (
                    <MuscleBadge key={name} label={name} />
                  ))}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={added ? "ghost" : "secondary"}
                disabled={added || full}
                onClick={() => {
                  onAdd(exercise.name);
                  setLastAdded(exercise.name);
                }}
                aria-label={added ? `Added: ${exercise.name}` : `Add ${exercise.name}`}
              >
                {added ? (
                  "Added"
                ) : (
                  <>
                    <Plus aria-hidden="true" />
                    Add
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
