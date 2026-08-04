// Latency smoke test: measures TTFB and full-response percentiles for each
// route against a *deployed* target (staging/preview — never run load against
// production users), then asserts the budgets in perf/budgets.json and, when
// perf/baseline.json holds a recorded latency section, fails on regression
// against it. Percentiles, not averages, per the latency-testing rules.
//
//   PERF_BASE_URL=https://<preview>.vercel.app node perf/latency-smoke.mjs
//   PERF_BASE_URL=... node perf/latency-smoke.mjs --record   # update baseline
//
// Part of the performance tier: run pre-release by hand, deliberately outside
// the CI test path (it needs a live environment).

// Requests are deliberately sequential: parallel in-flight requests would
// contend with each other and skew the measured percentiles.
/* oxlint-disable no-await-in-loop */

import { loadBaseline, loadBudgets, saveBaselineSection } from "./baseline.mjs";

const WARMUP_REQUESTS = 3;
const SAMPLES = Number.parseInt(process.env.PERF_SAMPLES ?? "30", 10);
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = process.env.PERF_BASE_URL;
if (!baseUrl) {
  console.error(
    "PERF_BASE_URL is not set.\n" +
      "Usage: PERF_BASE_URL=https://<staging-host> node perf/latency-smoke.mjs [--record]",
  );
  process.exit(2);
}

const record = process.argv.includes("--record");
const budgets = loadBudgets().latency;
const baseline = loadBaseline()?.latency ?? null;

function percentile(sortedMs, p) {
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

async function measureRoute(route) {
  const url = new URL(route, baseUrl);
  const ttfb = [];
  const total = [];
  for (let i = 0; i < WARMUP_REQUESTS + SAMPLES; i++) {
    const startedAt = performance.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    const headersAt = performance.now();
    await response.arrayBuffer();
    const bodyAt = performance.now();
    if (!response.ok) {
      throw new Error(`${url} responded ${response.status}`);
    }
    if (i >= WARMUP_REQUESTS) {
      ttfb.push(headersAt - startedAt);
      total.push(bodyAt - startedAt);
    }
  }
  ttfb.sort((a, b) => a - b);
  total.sort((a, b) => a - b);
  return {
    ttfbP50: Math.round(percentile(ttfb, 50)),
    ttfbP95: Math.round(percentile(ttfb, 95)),
    totalP50: Math.round(percentile(total, 50)),
    totalP95: Math.round(percentile(total, 95)),
  };
}

let failed = false;

function check(label, actualMs, limitMs) {
  const ok = actualMs <= limitMs;
  if (!ok) failed = true;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${actualMs} ms (limit ${limitMs} ms)`);
}

const results = {};
console.log(`Latency smoke against ${baseUrl} (${SAMPLES} samples/route)\n`);
for (const route of budgets.routes) {
  console.log(route);
  const measured = await measureRoute(route);
  results[route] = measured;
  check("TTFB p50", measured.ttfbP50, budgets.p50Ms);
  check("TTFB p95", measured.ttfbP95, budgets.p95Ms);
  const recorded = baseline?.routes?.[route];
  if (recorded) {
    // Drift gate: worse than the recorded baseline by more than the allowed
    // margin fails even while still inside the absolute budget.
    const limit = Math.round(recorded.ttfbP95 * (1 + budgets.maxRegressionPct / 100));
    check(`TTFB p95 vs baseline (${recorded.ttfbP95} ms)`, measured.ttfbP95, limit);
  } else {
    console.log("  note: no recorded baseline — run with --record to set one");
  }
  console.log(`       full response p50 ${measured.totalP50} ms, p95 ${measured.totalP95} ms`);
}

if (record) {
  const path = saveBaselineSection("latency", { baseUrl, samples: SAMPLES, routes: results });
  console.log(`\nBaseline recorded to ${path}`);
}

process.exit(failed ? 1 : 0);
