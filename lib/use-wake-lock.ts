"use client";

import { useEffect } from "react";

// Hold a screen wake lock while `active` is true, so the phone doesn't dim or
// lock mid-workout (e.g. while a rest timer counts down). The browser releases
// a wake lock whenever the tab is hidden, so re-acquire on visibilitychange.
// Best-effort: the API is only Baseline since 2025, and a request can be denied
// (low battery) — in either case the screen just keeps its default behavior.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Denied or unsupported — nothing the user needs to act on.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
