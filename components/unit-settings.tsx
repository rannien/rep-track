"use client";

import { useUnit } from "@/components/unit-provider";
import type { WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";

const OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lb", label: "Pounds (lb)" },
];

const chipBase =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

// Weight-unit preference. Sets stay stored in kg; the choice only changes
// what is typed and displayed, so switching back and forth never loses data.
export function UnitSettings() {
  const { unit, setUnit } = useUnit();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
          <Scale className="size-4 text-primary" aria-hidden="true" />
          Units
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          How weights are entered and shown. Your history is kept in kg, so switching is lossless.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Weight unit
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {OPTIONS.map(({ value, label }) => {
            const active = unit === value;
            return (
              <label
                key={value}
                className={cn(
                  chipBase,
                  active
                    ? "border border-primary bg-primary text-primary-foreground"
                    : "border border-border bg-card text-card-foreground hover:bg-secondary/60",
                )}
              >
                <input
                  type="radio"
                  name="weight-unit"
                  className="sr-only"
                  checked={active}
                  onChange={() => setUnit(value)}
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
