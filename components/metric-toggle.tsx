"use client";

import { useId } from "react";
import type { StatsMetric } from "@/lib/sessions";
import type { WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

// Segmented control that scopes every stats chart to one metric — volume and
// reps are different units and never share an axis. Visually-hidden native
// radios carry the exclusive-choice semantics and arrow-key behavior.
export function MetricToggle({
  value,
  unit,
  onChange,
}: {
  value: StatsMetric;
  unit: WeightUnit;
  onChange: (metric: StatsMetric) => void;
}) {
  const name = useId();
  const options: { value: StatsMetric; label: string }[] = [
    { value: "volume", label: `Volume (${unit})` },
    { value: "reps", label: "Reps" },
  ];

  return (
    <fieldset className="inline-flex w-fit items-center rounded-full border border-border bg-secondary p-0.5">
      <legend className="sr-only">Chart metric</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            value === option.value
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
