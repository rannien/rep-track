# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

```bash
pnpm dev            # Next.js dev server (http://localhost:3000)
pnpm build          # production build
pnpm start          # serve the production build
pnpm lint           # oxlint   (config: .oxlintrc.json)
pnpm lint:fix       # oxlint --fix
pnpm format         # oxfmt    (writes in place; config: .oxfmtrc.json)
pnpm format:check   # oxfmt --check
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm perf:bundle    # per-route bundle drift vs perf/baseline.json (after pnpm build)
pnpm perf:latency   # TTFB p50/p95 smoke against $PERF_BASE_URL (staging/preview)
```

**Tests are [vitest](https://vitest.dev) unit tests** covering the pure logic
in `lib/` (`sessions.test.ts`, `backup.test.ts`, `workouts.test.ts`,
`rest-timer.test.ts`, `adherence.test.ts`, `theme.test.ts`, `units.test.ts`, `compare.test.ts`, `plans.test.ts`):
payload validation (including hostile/prototype-pollution payloads), session
mutations (`addSetToSessions`/`removeSetFromSessions`/`updateSetInSessions`/
`removeSetWithUndo`+`restoreRemovedSet`), "last time" lookup, stats
aggregation, personal records, plan-adherence progress and per-muscle totals,
input parsing, kg/lb conversion round-trips, friend-comparison profile parsing and record leaders, date keying (including
`backdatedSessionStart`), backup round-trip/merge, theme resolution (including
executing the inline `THEME_INIT_SCRIPT` and `PLAN_INIT_SCRIPT` against
stubbed globals), plan-registry invariants (plan ids, day ids and day labels
unique across plans; one canonical definition per exercise name), day-legend
color assignment, and plan-data invariants for every shipped plan. No config file — vitest defaults
(node environment) suffice because the tested layer is IO-free. Tests import
from `"vitest"` explicitly; there is no globals setup. Keep component logic
extractable: pure state transitions live in `lib/`, providers stay thin.

**Performance checks live in `perf/`** (see `perf/README.md`), deliberately
outside the CI test path: `perf:bundle` compares gzipped per-route first-load
weight against the versioned `perf/baseline.json` (re-record with `--record`);
`perf:latency` asserts TTFB percentile budgets from `perf/budgets.json` against
a deployed preview URL. CI additionally runs `pnpm audit --prod --audit-level
high` and a gitleaks secrets scan; `pnpm-workspace.yaml` `overrides` keep
next's transitive `postcss`/`sharp` pins on patched versions.
versions.

**Linting/formatting is [oxc](https://oxc.rs), not ESLint/Prettier.** `oxlint` + `oxfmt` replace them — there is no eslint/prettier config or dependency. oxfmt formats with Prettier-compatible defaults (semicolons, double quotes, 80-col). `.oxlintrc.json` disables `react/react-in-jsx-scope` (the automatic JSX runtime makes it moot) and `import/no-unassigned-import` (side-effect CSS imports). The vendored skill under `.claude/` is excluded from oxfmt via `ignorePatterns`.

**The build type-checks.** `pnpm build` runs TypeScript and fails on type errors (no `ignoreBuildErrors`). `next.config.mjs` only sets `images.unoptimized: true`.

**pnpm build-script decisions live in `pnpm-workspace.yaml`.** `allowBuilds` declines `sharp` (unneeded: images are unoptimized) and allows `esbuild` (vitest's bundler). Without an entry there, pnpm v11 aborts every `pnpm <script>` with `ERR_PNPM_IGNORED_BUILDS` when a dependency ships a build script.

## Architecture

**Rep Track** — a single-page Next.js 16 App Router app (React 19, RSC) that renders a fixed weekly workout plan and lets the user log sets per training day locally. Originally scaffolded by **v0.app** (`generator: 'v0.app'`).

- **Two plans ship; one is active.** The plan data is hard-coded across three modules, with no backend or CMS: **`lib/workouts.ts`** owns the _shape_ (`Movement`/`Exercise`/`WorkoutDay`, `movementLabels`, `distinctDays`, `dayLegend`) and exports no plan data itself; **`lib/plan-barbell-strength.ts`** and **`lib/plan-dumbbell-hybrid.ts`** each hold one hand-edited `WorkoutDay[]`; **`lib/plans.ts`** owns identity and the stored preference (`plans` registry, `PlanId`, `WorkoutPlan`, `DEFAULT_PLAN_ID`, `planById`, `knownDays`, key `rep-track-plan` + `parseStoredPlanId`, `PLAN_INIT_SCRIPT`). To change exercises/days/sets/reps, edit the relevant `lib/plan-*.ts`. Adding a plan needs two edits nothing type-checks: its selector pair in the reveal rule at the bottom of `app/globals.css`, and `DAY_COLOR_SLOTS` in `lib/workouts.ts` — the two plans' four days exactly exhaust the categorical slots left once `--chart-3` is reserved for the exercise-scoped charts, so a third plan's days would fall back to the neutral unknown-day colour (a `dayLegend` test states that limit).
- **Active plan vs. known days — get this right or a settings toggle rewrites history.** The _active_ plan (`usePlan().plan`) is prescriptive: what can be logged, and the primary ordering. `knownDays(planId)` — every shipped plan's days, active first — is descriptive: how already-logged history is interpreted. A plan the app still ships is not "off-plan", so `muscleTotals`, the `/stats` exercise picker and `compareRecords` all take `knownDays`, and only the active plan drives `/` and the default exercise selection. Two invariants hold this up (`lib/plans.test.ts`, `lib/workouts.test.ts`): day ids **and** labels are unique across all plans, and an exercise name appearing in more than one plan carries identical `muscles`/`movement`/`youtube` (`muscleTotals` keys by name with last-wins `Map.set`, so divergent lists would let registry order decide what a lift trains). `sets`/`reps` may differ per plan — that's the point of a second plan.
- **`app/page.tsx`** (server component) renders **every** plan — it can't know which is active (see the plan-reveal note under hydration) — passing each plan's `WorkoutCard`s to `components/plan-panels.tsx` as `content`, which drops the inactive plan's children once hydrated. `app/layout.tsx` sets fonts (Geist), metadata/icons, renders `data-plan={DEFAULT_PLAN_ID}` on `<html>`, injects the pre-paint `THEME_INIT_SCRIPT` and `PLAN_INIT_SCRIPT`, wraps the app in `<ThemeProvider>` → `<UnitProvider>` → `<SessionProvider>` → `<RestTimerProvider>` → `<PlanProvider>` (innermost so the panels it is about to drop never render against a loaded session list), and mounts Vercel Analytics unconditionally (outside production it runs in debug mode and sends nothing). Pages: `/` (plan), `/history`, `/stats`, `/records` (all-time PRs), `/compare` (friend comparison), `/settings` (training plan + appearance + units + rest-timer preferences); the shared header nav is `components/page-nav.tsx` (server, `current` prop; pill labels hide below `sm`, so every pill carries an `aria-label`).
- **`components/workout-card.tsx`** (server) derives per-day stats (planned total sets/reps) from the day's exercises, headlines the card with `day.title`, renders the `DaySessionSummary`, and lists `ExerciseRow`s. The headline used to be a push/pull tally; it counted only two of the four `movement` values, so a squat- or hinge-led day read as having fewer exercises than it has — which is why the old plan mis-tagged Walking Lunges as `push` and Pec Deck as `pull`. `movement` now has no aggregate consumer: it is per-row badge text only.
- **`components/exercise-row.tsx`** (client) owns the per-exercise logging UI: an expandable panel to add sets (weight + reps), today's logged sets with inline editing (pencil → compact weight/reps inputs; saving never starts the rest timer), and a per-set "last time" reference for progressive overload.
- **Plan adherence lives in `lib/adherence.ts`** — the join of the plan (`lib/workouts.ts`) and the logged sessions, kept out of `lib/sessions.ts` so the session model stays plan-agnostic. `exerciseProgress` drives the "2/4 sets" chip on each row; `dayProgress` (per-exercise clamped, so extras can't mask a skipped lift) drives the day card's progress bar and "Workout complete" state. `muscleTotals` (same module — also a plan join; takes the days as a parameter so tests stay synthetic) feeds the per-muscle-group chart on `/stats`, crediting an exercise's full work to every muscle it lists, off-plan names bucketed under "Other". Callers pass `knownDays`, not the active plan, so the inactive plan's exercises keep their muscles instead of falling into that bucket.
- **Weights are stored in kg, always, per implement** (`LoggedSet.weight`, volumes, backups). The kg/lb preference (`lib/units.ts`, key `rep-track-unit`, `components/unit-provider.tsx` → `useUnit()`) converts only at the display/input edge: `parseWeightInput(value, unit)` returns kg, `formatSet`/`formatOneRepMax`/`formatVolume` take the unit, and charts convert point values before plotting (unit embedded in the point) so axes and tooltips agree. `weightFromKg`/`weightToKg` round so a typed lb value survives the round trip exactly.
- **Dual-implement sets**: `LoggedSet.double` (optional, literal `true`, absent otherwise) marks a set done with two implements at once (a dumbbell per hand). `setLoad()` in `lib/sessions.ts` is the _only_ place doubling happens — volume and `personalRecords` rank by it; `estimatedOneRepMax` deliberately stays per implement. `formatSet` renders the notation (`2×16 kg × 8`), and the ×2 toggle appears in the logging panel and both edit modes.
- **Backdating**: `components/logging-date-provider.tsx` (plan page only, pure view state) holds a per-day date override; `BackdatePicker` (single-date calendar popover in `DaySessionSummary`) sets it. `ExerciseRow` logs via `sessionOn(dayId, dateKey)` and `addSet(..., dateKey)`; a backfilled session gets `backdatedSessionStart` (local noon) as `startedAt`, and logging a backdated set never starts the rest timer.
- **/stats addition**: per-muscle-group totals chart (`components/muscle-totals-chart.tsx`). The all-time PR board lives on its own `/records` page (`components/pr-board.tsx`, fed by `personalRecords()` in `lib/sessions.ts`) — records are the heaviest set actually lifted per exercise (equal weight only takes the record with more reps), never an estimated 1RM, and they're kept off `/stats` because they aren't a date-filterable view.
- **Friend comparison** (`/compare`, `lib/compare.ts`, key `rep-track-compare-v1`): a friend's exported backup is imported as a read-only `ComparisonProfile` — never merged into the user's sessions, nothing leaves the device — and compared via `compareRecords` (union by exercise name, `knownDays` order first — active plan, then the other plan, then off-plan names — leader by `setLoad`) and `compareTotals` (average volume per session as the fair number when histories differ in length). `formatRecordsShareText` feeds the "Share my records" button on `/records` (Web Share API, clipboard fallback).

### Session tracking (the core feature)

Logging is organized around **training-day sessions**, not loose per-exercise entries. The model lives in **`lib/sessions.ts`** (`Session` → `ExerciseEntry` → `LoggedSet`): one `Session` per `(dayId, calendar date)`, each holding the sets logged for each exercise that day. All state flows through one React context:

- **`components/session-provider.tsx`** (client) is the single owner of session state and the only writer to `localStorage` (key `rep-track-sessions-v1`). It exposes `useSessions()` with `addSet` / `removeSet` / `removeSession` / `updateSet` / `todaySession` / `sessionOn` / `storageWarning`. `addSet` lazily creates the day's session and the exercise entry; `removeSet` prunes empty entries and sessions, and is undoable: the provider keeps a pending-removal stack and renders `components/undo-toast.tsx` (6 s window, batch undo via `restoreRemovedSet`, which re-targets by `(dayId, dateKey)` so undo survives session-id churn). `removeSession` deletes a whole session as a sequence of per-set removals (`removeSessionWithUndo`), so one Undo restores everything. History (`/history`) is editable: each session card has an edit-mode toggle (per-set inline edit/delete, same idiom as the logging panel) and an undoable delete-session button.
- **localStorage is treated as a trust boundary.** `parseSessionsBlob()` in `lib/sessions.ts` runtime-validates every stored session (invalid ones are dropped individually); when anything is rejected, the raw payload is first copied to `rep-track-sessions-v1-corrupt` so a later save can't destroy it. `saveSessions` returns a typed result instead of throwing; failures and recoveries surface through `storageWarning`, which drives a `role="alert"` banner rendered by the provider. A `storage` event listener keeps multiple tabs in sync, and a `lastSavedRef` identity check ensures only genuine user mutations are written back (never the mount-time load or another tab's echo).
- Consume sessions via `useSessions()` from any client component — **never read `localStorage` directly elsewhere.** `ExerciseRow` and `DaySessionSummary` are consumers.
- **Context flows through server components**: `SessionProvider` (client) wraps `WorkoutCard` (server) which renders `ExerciseRow`/`DaySessionSummary` (client) — the consumers still receive the context because they're in the provider's subtree in the final React tree.
- **"Last time" reference**: `lastEntryForExercise()` returns the most recent _prior_ session that logged a given exercise (excluding the in-progress one), so the UI can show what you lifted set-by-set last session (e.g. set 1: 80 kg × 8, set 2: 100 kg × 8) to drive progressive overload.

### Hydration-safe localStorage

The whole app SSR-prerenders, so anything derived from `localStorage` must be gated to avoid hydration mismatch: `SessionProvider` reads on mount and only writes after a `hydrated` flag flips, and consumers check `hydrated` before rendering session-derived content (initial client render must match the empty-state server render). Reuse this pattern for any new client persistence.

Two preferences are deliberate exceptions to "apply after hydration", because each decides **primary content or first paint**. That is the bar: a pre-paint inline script is justified only for those, and only with a test that executes the script string.

The **theme** is the first: `lib/theme.ts` exports `THEME_INIT_SCRIPT`, inlined as the first child of `<body>` in `app/layout.tsx`, which toggles the `dark` class on `<html>` before first paint (no light flash on a stored dark preference; `<html>` carries `suppressHydrationWarning` for this). `components/theme-provider.tsx` then owns the preference after mount — localStorage key `rep-track-theme` (validated by `parseStoredTheme`, garbage degrades to `system`), a `matchMedia` listener for live OS changes, and a `storage` listener for cross-tab sync. The script and `resolveTheme(parseStoredTheme(raw) ?? DEFAULT_THEME, systemDark)` must stay semantically identical — the test suite executes the script string to enforce it.

The **active plan** is the second, and it works differently because the plan is _content_, not a class: `/` server-renders every plan, each wrapped by `PlanPanels` in a `div[data-plan-panel=<id>]`, and an **unlayered** CSS rule in `app/globals.css` shows only the panel matching `<html data-plan>`. `app/layout.tsx` renders that attribute as `DEFAULT_PLAN_ID` (so a no-JS or blocked-storage visitor still gets exactly one plan) and `PLAN_INIT_SCRIPT` — parser-blocking, before any plan markup is parsed — rewrites it to the stored id. Unlike the theme script it _only overwrites when the stored value is a shipped id_, so garbage, an absent key and a throwing `localStorage` all keep the server-rendered default; it must stay semantically identical to `parseStoredPlanId(raw) ?? DEFAULT_PLAN_ID`, enforced the same way. `components/plan-provider.tsx` then owns the preference (`storage` listener for cross-tab sync, and a `hydrated`-gated effect keeping `<html data-plan>` in sync so a switch on `/settings` takes effect on an already-mounted `/`), and `PlanPanels` drops the inactive panel's children so the steady-state DOM and the log-a-set re-render path cost what a single plan costs.

Two things about that reveal rule are load-bearing. It must stay **unlayered**: inside `@layer base` it loses the cascade to any Tailwind utility, so a `flex`/`hidden` class landing on a panel wrapper would show both plans — which is also why the wrapper is deliberately class-free. And `display: none` (not `[hidden]`, which an ancestor attribute selector can't drive) is what keeps the inactive plan out of the accessibility tree, tab order and find-in-page. A cookie read in the server component would be the obvious alternative and was rejected: in Next 16 it de-opts `/` to a per-request render, which drops it from `perf/bundle-drift.mjs` (it globs `.next/server/app/*.html`), blows the `perf/latency-smoke.mjs` TTFB budget, and makes `public/sw.js`'s cached `/` fallback plan-specific instead of plan-agnostic. Past three or four plans, generate the CSS from the registry or move to per-plan static routes.

### Styling

- **Tailwind CSS v4** (CSS-first; configured via `@import 'tailwindcss'` in `app/globals.css`, no `tailwind.config`). PostCSS plugin in `postcss.config.mjs`.
- **shadcn components live in `components/ui/`**: `components.json` (style `base-nova`, on `@base-ui/react` rather than Radix) drives `pnpm dlx shadcn add …`. Vendored so far: `button`, `popover`, `calendar` (the date-range filter; deps `@base-ui/react`, `react-day-picker`, `date-fns`, `class-variance-authority`), `select` and `label` (the stats exercise picker). Note the CLI may skip adding peer deps like `@base-ui/react` to `package.json` — check `pnpm typecheck` after adding. Vendored files keep upstream style: `.oxlintrc.json` has a `components/ui/**` override silencing `no-shadow`, `react/no-unstable-nested-components`, and `jsx-a11y/label-has-associated-control`. Everything else is hand-written with Tailwind.
- Theme is driven by CSS custom properties (`--primary`, `--card`, `--muted-foreground`, etc.) defined in `globals.css` and exposed to Tailwind via `@theme inline`. Use the semantic token classes (`bg-primary`, `text-muted-foreground`, …) rather than raw colors.
- Merge class names with `cn()` from `lib/utils.ts`. Icons come from `lucide-react`.
- Import via the `@/*` alias (maps to the project root).
