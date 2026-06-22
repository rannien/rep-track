# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

```bash
pnpm dev      # Next.js dev server (http://localhost:3000)
pnpm build    # production build
pnpm start    # serve the production build
pnpm lint     # eslint .
pnpm exec tsc --noEmit   # real type-check — see caveat below
```

There is no test suite.

**Build skips type errors.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`, so `pnpm build` will succeed even with TypeScript errors. Run `pnpm exec tsc --noEmit` to actually surface type problems.

## Architecture

**Rep Track** — a single-page Next.js 16 App Router app (React 19, RSC) that renders a fixed weekly workout plan and lets the user log sets per training day locally. Originally scaffolded by **v0.app** (`generator: 'v0.app'`).

- **`lib/workouts.ts` is the source of truth for the displayed plan.** The `workouts` array (a `WorkoutDay[]`) is hard-coded here, along with the `Exercise`/`Movement` types and `movementLabels`. To change what exercises/days/sets/reps appear, edit this array — there is no backend or CMS.
- **`app/page.tsx`** (server component) maps over `workouts` and renders a `WorkoutCard` per day, wrapping the grid in `<SessionProvider>`. `app/layout.tsx` sets fonts (Geist), metadata/icons, and mounts Vercel Analytics in production only.
- **`components/workout-card.tsx`** (server) derives per-day stats (planned total sets/reps, push/pull counts) from the day's exercises, renders the `DaySessionSummary`, and lists `ExerciseRow`s.
- **`components/exercise-row.tsx`** (client) owns the per-exercise logging UI: an expandable panel to add sets (weight + reps), today's logged sets, and a per-set "last time" reference for progressive overload.

### Session tracking (the core feature)

Logging is organized around **training-day sessions**, not loose per-exercise entries. The model lives in **`lib/sessions.ts`** (`Session` → `ExerciseEntry` → `LoggedSet`): one `Session` per `(dayId, calendar date)`, each holding the sets logged for each exercise that day. All state flows through one React context:

- **`components/session-provider.tsx`** (client) is the single owner of session state and the only writer to `localStorage` (key `rep-track-sessions-v1`). It exposes `useSessions()` with `addSet` / `removeSet` / `todaySession`. `addSet` lazily creates today's session and the exercise entry; `removeSet` prunes empty entries and sessions.
- Consume sessions via `useSessions()` from any client component — **never read `localStorage` directly elsewhere.** `ExerciseRow` and `DaySessionSummary` are consumers.
- **Context flows through server components**: `SessionProvider` (client) wraps `WorkoutCard` (server) which renders `ExerciseRow`/`DaySessionSummary` (client) — the consumers still receive the context because they're in the provider's subtree in the final React tree.
- **"Last time" reference**: `lastEntryForExercise()` returns the most recent *prior* session that logged a given exercise (excluding the in-progress one), so the UI can show what you lifted set-by-set last session (e.g. set 1: 80 kg × 8, set 2: 100 kg × 8) to drive progressive overload.

### Hydration-safe localStorage

The whole app SSR-prerenders, so anything derived from `localStorage` must be gated to avoid hydration mismatch: `SessionProvider` reads on mount and only writes after a `hydrated` flag flips, and consumers check `hydrated` before rendering session-derived content (initial client render must match the empty-state server render). Reuse this pattern for any new client persistence.

### Styling

- **Tailwind CSS v4** (CSS-first; configured via `@import 'tailwindcss'` in `app/globals.css`, no `tailwind.config`). PostCSS plugin in `postcss.config.mjs`.
- **shadcn** with the `base-nova` style on top of **`@base-ui/react`** (not Radix); see `components.json`. New shadcn components land in `components/ui/`.
- Theme is driven by CSS custom properties (`--primary`, `--card`, `--muted-foreground`, etc.) defined in `globals.css` and exposed to Tailwind via `@theme inline`. Use the semantic token classes (`bg-primary`, `text-muted-foreground`, …) rather than raw colors.
- Merge class names with `cn()` from `lib/utils.ts`. Icons come from `lucide-react`.
- Import via the `@/*` alias (maps to the project root).
