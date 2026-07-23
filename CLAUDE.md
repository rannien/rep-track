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
```

**Tests are [vitest](https://vitest.dev) unit tests** covering the pure session
logic in `lib/sessions.ts` (`lib/sessions.test.ts`): payload validation, "last
time" lookup, stats aggregation, input parsing, date keying. No config file —
vitest defaults (node environment) suffice because the tested layer is IO-free.
Tests import from `"vitest"` explicitly; there is no globals setup.

**Linting/formatting is [oxc](https://oxc.rs), not ESLint/Prettier.** `oxlint` + `oxfmt` replace them — there is no eslint/prettier config or dependency. oxfmt formats with Prettier-compatible defaults (semicolons, double quotes, 80-col). `.oxlintrc.json` disables `react/react-in-jsx-scope` (the automatic JSX runtime makes it moot) and `import/no-unassigned-import` (side-effect CSS imports). The vendored skill under `.claude/` is excluded from oxfmt via `ignorePatterns`.

**The build type-checks.** `pnpm build` runs TypeScript and fails on type errors (no `ignoreBuildErrors`). `next.config.mjs` only sets `images.unoptimized: true`.

**pnpm build-script decisions live in `pnpm-workspace.yaml`.** `allowBuilds` declines `sharp` (unneeded: images are unoptimized) and allows `esbuild` (vitest's bundler). Without an entry there, pnpm v11 aborts every `pnpm <script>` with `ERR_PNPM_IGNORED_BUILDS` when a dependency ships a build script.

## Architecture

**Rep Track** — a single-page Next.js 16 App Router app (React 19, RSC) that renders a fixed weekly workout plan and lets the user log sets per training day locally. Originally scaffolded by **v0.app** (`generator: 'v0.app'`).

- **`lib/workouts.ts` is the source of truth for the displayed plan.** The `workouts` array (a `WorkoutDay[]`) is hard-coded here, along with the `Exercise`/`Movement` types and `movementLabels`. To change what exercises/days/sets/reps appear, edit this array — there is no backend or CMS.
- **`app/page.tsx`** (server component) maps over `workouts` and renders a `WorkoutCard` per day. `app/layout.tsx` sets fonts (Geist), metadata/icons, wraps the app in `<SessionProvider>`, and mounts Vercel Analytics unconditionally (outside production it runs in debug mode and sends nothing).
- **`components/workout-card.tsx`** (server) derives per-day stats (planned total sets/reps, push/pull counts) from the day's exercises, renders the `DaySessionSummary`, and lists `ExerciseRow`s.
- **`components/exercise-row.tsx`** (client) owns the per-exercise logging UI: an expandable panel to add sets (weight + reps), today's logged sets, and a per-set "last time" reference for progressive overload.

### Session tracking (the core feature)

Logging is organized around **training-day sessions**, not loose per-exercise entries. The model lives in **`lib/sessions.ts`** (`Session` → `ExerciseEntry` → `LoggedSet`): one `Session` per `(dayId, calendar date)`, each holding the sets logged for each exercise that day. All state flows through one React context:

- **`components/session-provider.tsx`** (client) is the single owner of session state and the only writer to `localStorage` (key `rep-track-sessions-v1`). It exposes `useSessions()` with `addSet` / `removeSet` / `todaySession` / `storageWarning`. `addSet` lazily creates today's session and the exercise entry; `removeSet` prunes empty entries and sessions.
- **localStorage is treated as a trust boundary.** `parseSessionsBlob()` in `lib/sessions.ts` runtime-validates every stored session (invalid ones are dropped individually); when anything is rejected, the raw payload is first copied to `rep-track-sessions-v1-corrupt` so a later save can't destroy it. `saveSessions` returns a typed result instead of throwing; failures and recoveries surface through `storageWarning`, which drives a `role="alert"` banner rendered by the provider. A `storage` event listener keeps multiple tabs in sync, and a `lastSavedRef` identity check ensures only genuine user mutations are written back (never the mount-time load or another tab's echo).
- Consume sessions via `useSessions()` from any client component — **never read `localStorage` directly elsewhere.** `ExerciseRow` and `DaySessionSummary` are consumers.
- **Context flows through server components**: `SessionProvider` (client) wraps `WorkoutCard` (server) which renders `ExerciseRow`/`DaySessionSummary` (client) — the consumers still receive the context because they're in the provider's subtree in the final React tree.
- **"Last time" reference**: `lastEntryForExercise()` returns the most recent _prior_ session that logged a given exercise (excluding the in-progress one), so the UI can show what you lifted set-by-set last session (e.g. set 1: 80 kg × 8, set 2: 100 kg × 8) to drive progressive overload.

### Hydration-safe localStorage

The whole app SSR-prerenders, so anything derived from `localStorage` must be gated to avoid hydration mismatch: `SessionProvider` reads on mount and only writes after a `hydrated` flag flips, and consumers check `hydrated` before rendering session-derived content (initial client render must match the empty-state server render). Reuse this pattern for any new client persistence.

### Styling

- **Tailwind CSS v4** (CSS-first; configured via `@import 'tailwindcss'` in `app/globals.css`, no `tailwind.config`). PostCSS plugin in `postcss.config.mjs`.
- **shadcn components live in `components/ui/`**: `components.json` (style `base-nova`, on `@base-ui/react` rather than Radix) drives `pnpm dlx shadcn add …`. Vendored so far: `button`, `popover`, `calendar` (the date-range filter; deps `@base-ui/react`, `react-day-picker`, `date-fns`, `class-variance-authority`). Note the CLI may skip adding peer deps like `@base-ui/react` to `package.json` — check `pnpm typecheck` after adding. Vendored files keep upstream style: `.oxlintrc.json` has a `components/ui/**` override silencing `no-shadow` and `react/no-unstable-nested-components`. Everything else is hand-written with Tailwind.
- Theme is driven by CSS custom properties (`--primary`, `--card`, `--muted-foreground`, etc.) defined in `globals.css` and exposed to Tailwind via `@theme inline`. Use the semantic token classes (`bg-primary`, `text-muted-foreground`, …) rather than raw colors.
- Merge class names with `cn()` from `lib/utils.ts`. Icons come from `lucide-react`.
- Import via the `@/*` alias (maps to the project root).
