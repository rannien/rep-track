import type { Movement } from "@/lib/workouts";
import { movementLabels } from "@/lib/workouts";
import { cn } from "@/lib/utils";

const movementStyles: Record<Movement, string> = {
  push: "bg-primary/10 text-primary border-primary/20",
  pull: "bg-accent-foreground/10 text-accent-foreground border-accent-foreground/15",
  hinge: "bg-secondary-foreground/10 text-secondary-foreground border-secondary-foreground/15",
  squat: "bg-foreground/10 text-foreground border-foreground/15",
};

export function MovementBadge({ movement }: { movement: Movement }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        movementStyles[movement],
      )}
    >
      {movementLabels[movement]}
    </span>
  );
}

export function MuscleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {label}
    </span>
  );
}
