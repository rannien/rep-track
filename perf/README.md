# Performance tier

Pre-release performance checks, deliberately **outside the CI test path** (`pnpm test` never runs
these). Budgets are policy and live in [budgets.json](budgets.json); recorded measurements live in
[baseline.json](baseline.json) — both versioned, so a regression is diffable. No credentials or
URLs belong in this directory; the target comes from the environment.

Rep Track has no backend: every route is statically prerendered and served by the host's CDN, and
all data stays in the browser. That shapes what is worth measuring here:

| Check                                               | Command                                                  | Needs                          |
| --------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| Bundle drift (per-route first-load JS+CSS, gzipped) | `pnpm perf:bundle` (after `pnpm build`)                  | nothing — runs locally         |
| Latency smoke (TTFB p50/p95 per route)              | `PERF_BASE_URL=https://<preview-host> pnpm perf:latency` | a deployed staging/preview URL |

Add `--record` to either command (e.g. `pnpm perf:bundle --record`) to accept the current
measurement as the new baseline — do this consciously, after a release you consider "good", and
commit the changed `baseline.json`.

- **Bundle drift** is the app-controlled share of user-perceived latency: fails when a route's
  gzipped first-load grows more than `bundle.maxGrowthPct` over the baseline.
- **Latency smoke** asserts absolute budgets (`latency.p50Ms`/`p95Ms` per route) _and_ regression
  against the recorded baseline (`latency.maxRegressionPct`). Run it against a Vercel preview
  deployment, not production. Sample count: `PERF_SAMPLES` (default 30).

There is no sustained load test: the app owns no server-side logic to saturate — generating load
against the static pages would only benchmark the CDN.
