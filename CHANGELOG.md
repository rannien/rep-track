# Changelog

Notable user-facing changes to Rep Track. Dates are release days on `main`.

## 2026-09-04

### Added

- **A second training plan you can switch to** (Settings → Training plan) — a **barbell strength
  A/B** block beside the original dumbbell plan: back squat, bench and bent-over row for heavy
  fours, then two accessories, and a hinge/incline/pull day. Five lifts a day instead of six.
  The choice is remembered on this device and applies _before_ the page paints, so you never see
  the wrong routine on the way to the gym — it even works offline and with JavaScript off.
  Switching never deletes or moves anything you've logged: each plan has its own training days,
  so History, Stats, Records and Compare cover every session whichever plan is active, and a
  non-active plan's exercises still count toward their real muscle groups instead of "Other".
  Romanian Deadlift, Incline Dumbbell Press and Lat Pulldown appear in both plans on purpose, so
  those three carry their history, personal records and "last time" reference straight across.

### Changed

- Each day card now leads with the day's name ("Squat · Bench · Row") instead of a Push/Pull
  tally. The tally only counted two of the four movement patterns, so a squat- or hinge-led day
  read as having fewer exercises than it has. Every exercise still shows its own movement badge —
  and with nothing depending on the tally any more, Walking Lunges is correctly a squat pattern
  and Pec Deck a push.
- **Romanian Deadlift** now credits Back as well as Legs, and **Incline Dumbbell Press** credits
  Triceps as well as Chest and Shoulders — an exercise means one set of muscle groups whichever
  plan it appears in. Nothing you logged changed, but per-muscle chart totals shift accordingly,
  including for past sessions.
- On `/stats`, session bars are colored from the active plan: its days take the first two hues
  and the other plan's days the next two, so a date range spanning a plan switch shows four
  distinguishable days. A day from neither plan — an imported backup, say — now reads as a
  neutral grey rather than borrowing a plan colour.

## 2026-08-19

### Added

- **×2 toggle for dual-dumbbell / both-arm sets** — walking lunges with two 16 kg dumbbells no
  longer undercount: keep typing the per-dumbbell weight and flip the ×2 chip next to the inputs.
  The set reads "2×16 kg × 8", volume and the muscle chart count the real 32 kg per rep, and
  Personal Records rank by total load (2×16 kg beats a single 30 kg). Estimated 1RM stays
  per-dumbbell on purpose. The toggle is also in both edit modes, so past sets can be fixed from
  the History page.
- **Compare with a friend** (`/compare`) — import a backup they exported from their History page
  as a read-only profile (never merged into your history; nothing leaves the device) and see
  records side by side per exercise with the heavier lift marked, plus totals and average volume
  per session. A **Share my records** button on `/records` sends a text summary through the
  share sheet (or copies it).

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
- **Edit past sessions** — every session on the History page has an edit mode (correct any set's
  weight/reps in place, delete single sets) and a delete-session button; both are undoable via
  the same toast as in-workout deletes, so one Undo brings a whole session back.

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
