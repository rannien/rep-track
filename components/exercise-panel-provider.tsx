"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ExercisePanelContextValue = {
  /** Key of the single open logging panel (`${dayId}:${exercise}`), or null when all are closed. */
  openPanel: string | null;
  setOpenPanel: (key: string | null) => void;
};

const ExercisePanelContext = createContext<ExercisePanelContextValue | null>(null);

export function useExercisePanel(): ExercisePanelContextValue {
  const ctx = useContext(ExercisePanelContext);
  if (!ctx) throw new Error("useExercisePanel must be used within <ExercisePanelProvider>");
  return ctx;
}

/** Accordion state for exercise logging panels: opening one closes the previous, page-wide. */
export function ExercisePanelProvider({ children }: { children: ReactNode }) {
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const value = useMemo(() => ({ openPanel, setOpenPanel }), [openPanel]);

  return <ExercisePanelContext.Provider value={value}>{children}</ExercisePanelContext.Provider>;
}
