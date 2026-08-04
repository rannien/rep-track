// Rest-timer domain logic, extracted from components/rest-timer-provider.tsx
// so the bounds and the stored-preference validation are testable without the
// React layer.

// Evidence-aligned default: rests over 60 s carry a small hypertrophy edge, so
// two minutes is a sensible starting point for working sets. The user can
// change it in settings; per-rest ±15 s covers one-off adjustments.
export const DEFAULT_REST_SECONDS = 120;
export const STEP_SECONDS = 15;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

// Clamp a requested default rest length into the supported range, whole
// seconds only.
export function clampRestSeconds(seconds: number): number {
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}

// localStorage is a trust boundary (see lib/sessions.ts): the stored rest
// length may be absent, stale, or hand-edited. Only a whole number of seconds
// within bounds is accepted; anything else yields null and the caller keeps
// the built-in default.
export function parseStoredRestSeconds(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const seconds = Number.parseInt(raw, 10);
  return seconds >= MIN_REST_SECONDS && seconds <= MAX_REST_SECONDS ? seconds : null;
}

// m:ss for the countdown clock and its aria-label.
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
