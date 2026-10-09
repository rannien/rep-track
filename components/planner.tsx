"use client";

import { useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Copy, Pencil, Plus, TriangleAlert } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PlanEditor } from "@/components/plan-editor";
import { usePlan } from "@/components/plan-provider";
import { useSessions } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { type CustomPlanId, MAX_CUSTOM_PLANS, isCustomId, isUsable } from "@/lib/custom-plans";
import type { PlanDay } from "@/lib/workouts";
import { useSetSearchParams } from "@/lib/use-set-search-params";

export function PlannerSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl bg-secondary" aria-hidden="true" />;
}

// The selected plan lives in ?plan=, so reload and back/forward keep the editor open.
export function Planner() {
  const searchParams = useSearchParams();
  const setSearchParams = useSetSearchParams();
  const {
    hydrated,
    plans,
    customPlans,
    planId,
    setPlanId,
    createCustomPlan,
    deleteCustomPlan,
    plansStorageWarning,
  } = usePlan();
  const { sessions } = useSessions();
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

  if (!hydrated) return <PlannerSkeleton />;

  const warning = plansStorageWarning ? (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      {plansStorageWarning === "save-failed"
        ? "Your plans can't be saved — browser storage is full or unavailable."
        : "Some saved plans couldn't be read and were skipped. Everything else was recovered."}
    </p>
  ) : null;

  const selected = customPlans.find((plan) => plan.id === searchParams.get("plan"));
  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        {warning}
        <PlanEditor plan={selected} onBack={() => setSearchParams({ plan: null })} />
      </div>
    );
  }

  const atCap = customPlans.length >= MAX_CUSTOM_PLANS;
  const builtIns = plans.filter((plan) => !isCustomId(plan.id));

  function create(source?: { name: string; days: PlanDay[] }) {
    const id = createCustomPlan(source);
    if (id !== null) setSearchParams({ plan: id });
  }

  function loggedSessions(id: CustomPlanId): number {
    const plan = customPlans.find((candidate) => candidate.id === id);
    const dayIds = new Set(plan?.days.map((day) => day.id));
    return sessions.filter((session) => dayIds.has(session.dayId)).length;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {warning}

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-card-foreground">Start a plan</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={atCap} onClick={() => create()}>
            <Plus aria-hidden="true" />
            New plan
          </Button>
          {builtIns.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              variant="outline"
              disabled={atCap}
              onClick={() => create(plan)}
            >
              <Copy aria-hidden="true" />
              Copy {plan.name}
            </Button>
          ))}
        </div>
        {atCap ? (
          <p className="text-xs text-muted-foreground">
            You have {MAX_CUSTOM_PLANS} plans, the most a device keeps — delete one to start
            another.
          </p>
        ) : null}
      </section>

      <h2
        ref={listHeadingRef}
        tabIndex={-1}
        className="text-sm font-semibold text-foreground outline-none"
      >
        Your plans
      </h2>
      {customPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plans of your own yet. Start from scratch or copy a built-in plan and change it.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {customPlans.map((plan) => {
            const name = plan.name.trim() || "Untitled plan";
            const exercises = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);
            const logged = loggedSessions(plan.id);
            return (
              <li
                key={plan.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-semibold text-card-foreground">
                    {name}
                    {planId === plan.id ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <CircleCheck className="size-3.5" aria-hidden="true" />
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {plan.days.length} days · {exercises} exercises
                    {isUsable(plan) ? "" : " · not ready to use yet"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {planId !== plan.id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!isUsable(plan)}
                      onClick={() => setPlanId(plan.id)}
                    >
                      Use
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSearchParams({ plan: plan.id })}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={atCap}
                    aria-label={`Duplicate ${name}`}
                    onClick={() => create({ name, days: plan.days })}
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                  <ConfirmButton
                    label={`Delete ${name}`}
                    confirmLabel="Delete plan"
                    warning={
                      logged > 0
                        ? `${logged} logged ${logged === 1 ? "session stays" : "sessions stay"} in History but will no longer belong to a plan.`
                        : undefined
                    }
                    onConfirm={() => {
                      deleteCustomPlan(plan.id);
                      listHeadingRef.current?.focus();
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
