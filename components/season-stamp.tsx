"use client";

import { useEffect } from "react";
import { seasonOn } from "@/lib/season";

// Stamps <html data-season> after hydration; counterpart: the data-season rules in app/globals.css.
export function SeasonStamp() {
  useEffect(() => {
    const season = seasonOn(new Date());
    if (!season) return;

    const root = document.documentElement;
    root.dataset.season = season;
    return () => {
      delete root.dataset.season;
    };
  }, []);

  return null;
}
