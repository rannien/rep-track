import type { ReactNode } from "react";

// Shared chrome for the stats charts: recharts axis styling and the
// presentational tooltip shell each chart's content component fills in.
// Colors reference the raw CSS custom properties so `.dark` swaps them
// without any JS.

export const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

export function formatCount(value: number): string {
  return value.toLocaleString();
}

// Same zero-as-dash rendering the history and day summary use for volume.
export function formatVolume(volume: number): string {
  return volume > 0 ? `${volume.toLocaleString()} kg` : "—";
}

export function ChartTooltipFrame({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-popover-foreground">
        {title}
      </p>
      <dl className="flex flex-col gap-0.5">{children}</dl>
    </div>
  );
}

export function ChartTooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-popover-foreground">{value}</dd>
    </div>
  );
}

// Series key dot for tooltip titles and the hand-rolled legend. Inline style
// is required: the color is a runtime-chosen custom property.
export function SeriesSwatch({ color }: { color: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-sm"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}
