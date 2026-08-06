"use client";

import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const chipBase =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

// Theme preference. Before hydration the context reports the default
// ("system"), so that chip may flip to the stored choice after mount — the
// same accepted behavior as RestTimerSettings' preset chips.
export function ThemeSettings() {
  const { preference, setPreference } = useTheme();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
          <SunMoon className="size-4 text-primary" aria-hidden="true" />
          Appearance
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          How Rep Track looks on this device — System follows your OS setting.
        </p>
      </div>

      <fieldset>
        <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Theme
        </legend>
        {/* Margin, not fieldset gap: a legend is not a flex item, so gap
            between it and the options never applies. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = preference === value;
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
                  name="theme-preference"
                  className="sr-only"
                  checked={active}
                  onChange={() => setPreference(value)}
                />
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
