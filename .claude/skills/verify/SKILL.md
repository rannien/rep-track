---
name: verify
description: Build, launch, and drive Rep Track to verify a change end-to-end in a real browser.
---

# Verifying Rep Track changes

## Launch

```bash
pnpm dev    # http://localhost:3000, ready in <1s (Turbopack)
```

No login, no env vars. All state is client-side in localStorage under the key
`rep-track-sessions-v1` (shape: `Session[]` from `lib/sessions.ts`).

## Drive (Playwright, no project dep)

Playwright is not a project dependency. Install it in the session scratchpad and use the
system Chrome — the ms-playwright browser cache may not match the package version:

```bash
cd <scratchpad> && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright
```

```js
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // mobile-first
```

## Gotchas

- **Seed history before load** with `ctx.addInitScript` writing `rep-track-sessions-v1`;
  the app reads it on mount (hydration gate), so it must be set before page scripts run.
  Use past `dateKey`/`startedAt` values unless you want a "today" session.
- **Panel animations are 300ms** (`grid-template-rows` transition in `exercise-row.tsx`);
  wait ~500ms after a click before asserting open/closed state.
- Useful handles: the per-exercise log button is
  `getByRole("button", { name: "Log a set for <Exercise Name>" })` and exposes
  `aria-expanded`; history items are plain `<details>` elements (`details[open]`).

## Flows worth driving

- Main page: open a row via `+`, log a set (weight/reps → Save), check the
  "sets today" badge and the "last time" hints.
- Accordion: only one exercise panel open page-wide; only one history `<details>` open.
- History page (`/history`): seeded sessions render most-recent-first with per-exercise
  volume.
