"use client";

import type { ReactNode } from "react";
import { usePlan } from "@/components/plan-provider";
import { isCustomId } from "@/lib/custom-plans";
import type { BuiltInPlanId } from "@/lib/plans";

type PanelId = BuiltInPlanId | "custom";

// Every shipped plan plus one panel shared by custom plans is server-rendered so
// PLAN_INIT_SCRIPT can reveal one; inactive children are dropped once hydrated.
export function PlanPanels({ panels }: { panels: { id: PanelId; content: ReactNode }[] }) {
  const { hydrated, planId } = usePlan();
  const activePanel: PanelId = isCustomId(planId) ? "custom" : planId;

  return panels.map(({ id, content }) => (
    // The wrapper always renders and only its children are dropped: a keyed
    // filter would make React move the surviving panel's DOM (insertBefore),
    // which can blur focus for no gain. `!hydrated ||` keeps the first client
    // render identical to the server HTML, so there is no mismatch — the
    // usual hydration gate, used to widen the first render rather than
    // narrow it. The wrapper carries no classes on purpose: a Tailwind
    // display utility here would outrank the reveal rule in the cascade.
    <div key={id} data-plan-panel={id}>
      {!hydrated || id === activePanel ? content : null}
    </div>
  ));
}
