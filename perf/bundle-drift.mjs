// Bundle drift check: the app is fully static, so the app-controlled share of
// user-perceived latency is what we ship — this measures per-route first-load
// weight (gzipped bytes) from the production build and fails when a route
// grows past the budgeted margin over perf/baseline.json.
//
//   pnpm build && node perf/bundle-drift.mjs             # compare to baseline
//   pnpm build && node perf/bundle-drift.mjs --record    # accept current size
//
// A route's weight = its prerendered HTML plus every /_next/static asset that
// HTML references (scripts, stylesheets, preloads) — exactly what a cold first
// load fetches, and independent of Next's build-manifest format churn.
//
// Runs anywhere `pnpm build` runs (no network), but stays out of the CI test
// path: a drift failure means "look and decide", not "the code is broken".

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PROJECT_ROOT, loadBaseline, loadBudgets, saveBaselineSection } from "./baseline.mjs";

const NEXT_DIR = join(PROJECT_ROOT, ".next");
const APP_DIR = join(NEXT_DIR, "server", "app");

let htmlFiles;
try {
  htmlFiles = readdirSync(APP_DIR).filter(
    // Underscore routes (_not-found, _global-error) are framework plumbing,
    // not pages users load.
    (name) => name.endsWith(".html") && !name.startsWith("_"),
  );
} catch {
  console.error("No production build found — run `pnpm build` first.");
  process.exit(2);
}

const budgets = loadBudgets().bundle;
const baseline = loadBaseline()?.bundle ?? null;
const record = process.argv.includes("--record");

const gzipSizeCache = new Map();
function gzipSize(path) {
  let size = gzipSizeCache.get(path);
  if (size === undefined) {
    size = gzipSync(readFileSync(path)).length;
    gzipSizeCache.set(path, size);
  }
  return size;
}

const routes = {};
for (const htmlFile of htmlFiles) {
  const route = htmlFile === "index.html" ? "/" : `/${htmlFile.slice(0, -".html".length)}`;
  const html = readFileSync(join(APP_DIR, htmlFile), "utf8");
  const assets = new Set(
    [...html.matchAll(/(?:src|href)="\/_next\/(static\/[^"]+)"/g)].map((m) => m[1]),
  );
  let bytes = gzipSize(join(APP_DIR, htmlFile));
  for (const asset of assets) bytes += gzipSize(join(NEXT_DIR, asset));
  routes[route] = { gzipBytes: bytes, files: assets.size + 1 };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

let failed = false;
console.log("Per-route first-load bundle (gzipped)\n");
for (const [route, { gzipBytes, files }] of Object.entries(routes)) {
  const recorded = baseline?.routes?.[route];
  if (!recorded) {
    console.log(`  new  ${route}: ${kb(gzipBytes)} (${files} files) — no baseline`);
    continue;
  }
  const limit = Math.round(recorded.gzipBytes * (1 + budgets.maxGrowthPct / 100));
  const ok = gzipBytes <= limit;
  if (!ok) failed = true;
  const delta = gzipBytes - recorded.gzipBytes;
  const sign = delta >= 0 ? "+" : "";
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${route}: ${kb(gzipBytes)} (${sign}${kb(delta)} vs baseline, ` +
      `limit ${kb(limit)})`,
  );
}
if (baseline) {
  for (const route of Object.keys(baseline.routes ?? {})) {
    if (!(route in routes)) console.log(`  gone ${route}: in baseline but not in this build`);
  }
} else {
  console.log("\nNo baseline recorded — run with --record to set one.");
}

if (record) {
  const path = saveBaselineSection("bundle", { routes });
  console.log(`\nBaseline recorded to ${path}`);
}

process.exit(failed ? 1 : 0);
