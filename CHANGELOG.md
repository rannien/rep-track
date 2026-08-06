# Changelog

Notable user-facing changes to Rep Track. Dates are release days on `main`.

## 2026-08-06

A big day: two feature phases plus follow-up fixes.

### Added

- **Edit a logged set in place** — pencil button on every set in today's panel opens compact
  weight/reps inputs (Enter saves, Escape cancels). Corrections never start the rest timer.
- **Undo for deleted sets** — deleting a set shows a 6-second undo toast; rapid deletes batch
  into one "Removed N sets" undo. Restoring works even after the session was pruned and
  recreated.
- **Plan adherence while training** — each exercise shows a "2/4 sets" chip (checkmark when the
  target is met, honest "5/4" past it) and each day card gets a progress bar with a
  "Workout complete" state. Extra sets of one lift can't mask a skipped one.
- **Settings page** (`/settings`) with Appearance, Units, and the Rest timer preferences
  (moved from the plan page).
- **Dark mode** — light / dark / system, applied before first paint (no flash), synced across
  tabs, following live OS changes.
- **kg/lb unit preference** — weights are entered and shown in your unit; history stays stored
  in kg, so switching is lossless and typed lb values round-trip exactly. Charts, tooltips, and
  axes agree.
- **Personal records page** (`/records`) — the heaviest set you actually lifted per exercise
  (an equal weight only takes the record with more reps), with an exercise search that keeps
  true all-time ranks. Real lifts only — no estimated 1RM.
- **Muscle-group analytics** — a per-muscle volume/reps chart on `/stats`; each set credits
  every muscle its exercise targets, off-plan work lands under "Other".
- **Backdate a missed workout** — "Log a past day" on each day card switches logging to a past
  date; backfilled sessions never start the rest timer.
- **Shared page navigation** with icon pills that fit four destinations on a 375 px screen.

### Changed

- The PR board moved off `/stats` to its own `/records` page (records aren't a date-filterable
  view) and ranks by lifted weight instead of estimated 1RM.
- Plan: **Bent-Over Barbell Rows → Bent-Over Dumbbell Rows** (form-video link updated).
  Previously logged sets stay under the old name.
- Dark mode now wears the indigo brand (previously stock grayscale); all primary color pairs
  verified ≥ WCAG AA contrast.

### Notes

- Bodyweight/TRX work: leave the weight field empty — the set counts toward sets/reps and
  adherence, contributes 0 volume, and never fakes a PR. Compare such sessions with the
  Reps metric on `/stats`.
