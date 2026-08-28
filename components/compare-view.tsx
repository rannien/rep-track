"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions } from "@/components/session-provider";
import { useUnit } from "@/components/unit-provider";
import { parseBackup } from "@/lib/backup";
import {
  COMPARE_KEY,
  type ComparisonProfile,
  type Leader,
  MAX_PROFILE_NAME_LENGTH,
  clearComparisonProfile,
  compareRecords,
  compareTotals,
  loadComparisonProfile,
  normalizeProfileName,
  parseComparisonProfile,
  saveComparisonProfile,
} from "@/lib/compare";
import { type PersonalRecord, formatSessionDate, formatSet } from "@/lib/sessions";
import { type WeightUnit, formatVolume } from "@/lib/units";
import { cn } from "@/lib/utils";
import { workouts } from "@/lib/workouts";
import { CircleCheck, Trophy, TriangleAlert, Upload, Users, X } from "lucide-react";

type Status = { kind: "success" | "error"; message: string };

const primaryButton =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const cardClass =
  "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5";
const columnHeading =
  "pb-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

// The read-only friend profile lives in its own localStorage slot, owned here
// (this is its only consumer): read on mount behind the usual hydration gate,
// written only on import/remove, adopted from other tabs via the storage event.
export function CompareView() {
  const { hydrated, sessions } = useSessions();
  const { unit } = useUnit();
  const [profile, setProfile] = useState<ComparisonProfile | null>(null);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(loadComparisonProfile());
    setProfileHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== COMPARE_KEY) return; // null key = storage.clear()
      setProfile(parseComparisonProfile(e.key === null ? null : e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function handleFile(file: File) {
    setStatus(null);
    const result = parseBackup(await file.text());
    if (result.sessions.length === 0) {
      setStatus({
        kind: "error",
        message:
          result.kind === "corrupt"
            ? "That file isn't a Rep Track backup, or it's damaged."
            : "No valid sessions found in that file.",
      });
      return;
    }
    // Replacing keeps the current label; a first import takes the typed name.
    const next: ComparisonProfile = {
      name: normalizeProfileName(profile ? profile.name : name),
      importedAt: new Date().toISOString(),
      sessions: result.sessions,
    };
    const saved = saveComparisonProfile(next);
    if (!saved.ok) {
      setStatus({
        kind: "error",
        message: "Couldn't store the comparison — browser storage is full or unavailable.",
      });
      return;
    }
    setProfile(next);
    const dropped = result.kind === "partial" ? ` (${result.dropped} invalid skipped)` : "";
    setStatus({
      kind: "success",
      message: `Imported ${plural(result.sessions.length, "session")} from ${next.name}${dropped}.`,
    });
  }

  function handleRemove() {
    clearComparisonProfile();
    setProfile(null);
    setStatus({ kind: "success", message: "Comparison removed — your own history is untouched." });
  }

  // Same hydration gate as the other pages: nothing localStorage-derived until
  // both the sessions and the profile have been read.
  if (!hydrated || !profileHydrated) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      className="sr-only"
      aria-hidden="true"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Reset so re-picking the same file fires change again.
        e.target.value = "";
        if (file) void handleFile(file);
      }}
    />
  );

  const statusLine = (
    <p aria-live="polite">
      {status ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            status.kind === "success" ? "text-primary" : "text-destructive",
          )}
        >
          {status.kind === "success" ? (
            <CircleCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-3.5" aria-hidden="true" />
          )}
          {status.message}
        </span>
      ) : null}
    </p>
  );

  if (!profile) {
    return (
      <section className={cardClass}>
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
            <Users className="size-4 text-primary" aria-hidden="true" />
            Compare with a friend
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ask them to export a backup from their History page and import it here. It&apos;s
            read-only: their sets never mix into your history, and nothing leaves this device.
          </p>
        </div>
        <label className="flex flex-col gap-1 sm:max-w-xs">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Friend&apos;s name
          </span>
          <input
            type="text"
            value={name}
            maxLength={MAX_PROFILE_NAME_LENGTH}
            placeholder="Friend"
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={primaryButton}
          >
            <Upload className="size-4" aria-hidden="true" />
            Import their backup
          </button>
        </div>
        {fileInput}
        {statusLine}
      </section>
    );
  }

  const totals = compareTotals(sessions, profile.sessions);
  const records = compareRecords(sessions, profile.sessions, workouts);
  const totalRows: { label: string; you: string; friend: string; emphasis?: true }[] = [
    {
      label: "Sessions",
      you: totals.you.sessions.toLocaleString(),
      friend: totals.friend.sessions.toLocaleString(),
    },
    {
      label: "Sets",
      you: totals.you.sets.toLocaleString(),
      friend: totals.friend.sets.toLocaleString(),
    },
    {
      label: "Reps",
      you: totals.you.reps.toLocaleString(),
      friend: totals.friend.reps.toLocaleString(),
    },
    {
      label: "Total volume",
      you: formatVolume(totals.you.volume, unit),
      friend: formatVolume(totals.friend.volume, unit),
    },
    {
      label: "Avg volume / session",
      you: formatVolume(totals.you.avgVolumePerSession, unit),
      friend: formatVolume(totals.friend.avgVolumePerSession, unit),
      emphasis: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <section className={cardClass}>
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
            <Users className="size-4 text-primary" aria-hidden="true" />
            You vs {profile.name}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {profile.name}&apos;s data as of {formatSessionDate(profile.importedAt)} ·{" "}
            {plural(profile.sessions.length, "session")}. Read-only — your own history is untouched.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={secondaryButton}
          >
            <Upload className="size-4" aria-hidden="true" />
            Replace backup
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden="true" />
            Remove
          </button>
        </div>
        {fileInput}
        {statusLine}
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-card-foreground">Totals</h2>
          <p className="text-xs text-muted-foreground">
            Totals depend on how much history each of you has — average volume per session is the
            fairer number.
          </p>
        </div>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr>
              <th scope="col" className={columnHeading}>
                <span className="sr-only">Metric</span>
              </th>
              <th scope="col" className={columnHeading}>
                You
              </th>
              <th scope="col" className={columnHeading}>
                {profile.name}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {totalRows.map((row) => (
              <tr key={row.label} className={cn(row.emphasis && "font-semibold")}>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-muted-foreground">
                  {row.label}
                </th>
                <td className="py-2 pr-3 text-card-foreground">{row.you}</td>
                <td className="py-2 text-card-foreground">{row.friend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-card-foreground">Records</h2>
          <p className="text-xs text-muted-foreground">
            Heaviest set per exercise. The trophy marks the heavier total load — a doubled set
            counts both dumbbells.
          </p>
        </div>
        {/* Wide content scrolls inside its own container, never the page. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr>
                <th scope="col" className={columnHeading}>
                  Exercise
                </th>
                <th scope="col" className={columnHeading}>
                  You
                </th>
                <th scope="col" className={columnHeading}>
                  {profile.name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((row) => (
                <tr key={row.exercise}>
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-card-foreground">
                    {row.exercise}
                    {row.leader === "tie" ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(tie)</span>
                    ) : null}
                  </th>
                  <RecordCell record={row.mine} leads={row.leader === "you"} unit={unit} />
                  <RecordCell record={row.theirs} leads={row.leader === "friend"} unit={unit} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// A side's record: trophy + bold for the leader (icon and weight together —
// never color alone), a dash when that side has no record for the exercise.
function RecordCell({
  record,
  leads,
  unit,
}: {
  record: PersonalRecord | null;
  leads: boolean;
  unit: WeightUnit;
}) {
  if (!record) {
    return <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">—</td>;
  }
  return (
    <td
      className={cn(
        "py-2 pr-3 whitespace-nowrap",
        leads ? "font-semibold text-card-foreground" : "text-card-foreground",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {leads ? (
          <Trophy className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        ) : null}
        {formatSet(record.set, unit)}
        {leads ? <span className="sr-only"> (leads)</span> : null}
      </span>
    </td>
  );
}

// Keep the Leader type referenced for readers of RecordCell's call sites.
export type { Leader };
