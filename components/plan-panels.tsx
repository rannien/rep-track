"use client";

import type { ReactNode } from "react";
import { usePlan } from "@/components/plan-provider";
import type { PlanId } from "@/lib/plans";

// The plan page server-renders every plan so PLAN_INIT_SCRIPT can reveal the
// active one before first paint (see app/globals.css) — the server can't know
// which plan is stored. This drops the inactive plan's children once the
// preference is known, so the steady-state DOM, the useSessions() subscriber
// count, and the "log a set → every row re-renders" path cost exactly what
// they did with a single plan.
export function PlanPanels({ panels }: { panels: { id: PlanId; content: ReactNode }[] }) {
  const { hydrated, planId } = usePlan();

  return panels.map(({ id, content }) => (
    // The wrapper always renders and only its children are dropped: a keyed
    // filter would make React move the surviving panel's DOM (insertBefore),
    // which can blur focus for no gain. `!hydrated ||` keeps the first client
    // render identical to the server HTML, so there is no mismatch — the
    // usual hydration gate, used to widen the first render rather than
    // narrow it. The wrapper carries no classes on purpose: a Tailwind
    // display utility here would outrank the reveal rule in the cascade.
    <div key={id} data-plan-panel={id}>
      {!hydrated || id === planId ? content : null}
    </div>
  ));
}
