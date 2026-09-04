# Rep Track

A personal workout tracker for a fixed weekly plan: open it at the gym, log your sets, and let it
tell you what you lifted last time. Everything is stored locally in your browser — no account, no
backend, no data leaving your device.

**Live:** https://rep-track-ten.vercel.app

## Features

- **Two built-in plans** — a barbell strength A/B (heavy low-rep compounds plus accessories) and
  the original dumbbell hybrid A/B, both defined in code. Pick the active one under Settings →
  Training plan; the choice is remembered per device and applies before the page paints. Each
  exercise shows target sets × reps, muscles, movement type, and a form-video search link.
  Switching plans moves nothing: History, Stats, Records and Compare read across both plans, so a
  non-active plan's exercises still count toward their real muscle groups.
- **Set logging** — weight + reps per set, grouped into one session per training day and calendar
  date. A "last time" reference shows the previous session's sets for each exercise, set by set,
  to drive progressive overload.
- **Personal records** — estimated one-rep max (Epley) per exercise; a PR badge highlights the
  actual logged set behind a new record.
- **Rest timer** — starts automatically when you log a set (default 2:00, configurable presets,
  ±15 s mid-rest), with a completion chime, vibration, and a screen wake lock while it runs.
- **History** — every session set by set, most recent first.
- **Stats** — volume/reps per session, per-exercise totals, and exercise trends over time
  (including estimated 1RM), filterable by date range; view state lives in the URL.
- **Backup & restore** — export the whole history as a JSON file and import it on another device,
  either merged into or replacing the local history. A reminder nudges you when unbacked-up
  sessions accumulate.
- **Offline-ready PWA** — a service worker keeps the app shell available when the gym's signal
  drops; sets are logged to localStorage regardless.

## Tech stack

Next.js 16 (App Router, React 19, static prerender) · Tailwind CSS v4 · shadcn/ui (base-nova on
Base UI) · Recharts · TypeScript · vitest · oxlint + oxfmt · pnpm. Originally scaffolded with
[v0.app](https://v0.app).

There is no server-side logic: every route is statically prerendered, and all state lives in
`localStorage` (treated as a trust boundary — stored payloads are runtime-validated on load).

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

| Command                             | What it does                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| `pnpm build` / `pnpm start`         | production build / serve it                                          |
| `pnpm test`                         | vitest unit tests (pure logic in `lib/`)                             |
| `pnpm typecheck`                    | `tsc --noEmit`                                                       |
| `pnpm lint` / `pnpm lint:fix`       | oxlint                                                               |
| `pnpm format` / `pnpm format:check` | oxfmt                                                                |
| `pnpm perf:bundle`                  | per-route bundle drift vs the recorded baseline (after `pnpm build`) |
| `pnpm perf:latency`                 | TTFB percentile smoke against `$PERF_BASE_URL`                       |

CI runs formatting, linting, type-checking, tests, a production dependency audit, and a gitleaks
secrets scan on every push and pull request. Performance checks live in [perf/](perf/README.md),
deliberately outside the CI test path.

## Customizing the plan

The workout plans are data, not UI. Each plan is one module —
[lib/plan-barbell-strength.ts](lib/plan-barbell-strength.ts),
[lib/plan-dumbbell-hybrid.ts](lib/plan-dumbbell-hybrid.ts) — holding a `WorkoutDay[]`; edit one to
change days, exercises, or targets. To add a plan, write a third module, register it in
[lib/plans.ts](lib/plans.ts), and add its selector pair to the reveal rule at the bottom of
[app/globals.css](app/globals.css).

Two identifiers are load-bearing:

- **Day ids key sessions.** A session is stored against `(dayId, calendar date)`, so renaming a
  day id detaches every session already logged under it. Ids must also be unique across plans.
- **Exercise names are the join key to logged history.** Renaming an exercise starts a fresh
  history for it; reusing a name across plans deliberately shares one history (which is why
  Romanian Deadlift, Incline Dumbbell Press and Lat Pulldown appear in both plans), and those
  shared entries must agree on muscles, movement and video link.

Data-integrity tests in `lib/workouts.test.ts` and `lib/plans.test.ts` guard all of it.

## Data & privacy

All training data stays in your browser's `localStorage`. There is no server, no sync, and no
tracking of your training data; the only way it leaves the device is the backup file you export
yourself. Device preferences — active plan, theme, units, rest length — live in `localStorage`
too and are deliberately not part of the backup file, which holds sessions only. Browsers may evict local storage under pressure — export a backup now and then (the app
reminds you).

## License

[MIT](LICENSE)
