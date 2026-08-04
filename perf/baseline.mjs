// Shared plumbing for the perf scripts: budgets (hand-set policy) and the
// baseline (recorded measurements) both live versioned in this directory, per
// the pre-production testing setup. Credentials/URLs come from the
// environment, never from these files.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PERF_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(PERF_DIR, "..");
const BASELINE_PATH = join(PERF_DIR, "baseline.json");
const BUDGETS_PATH = join(PERF_DIR, "budgets.json");

export function loadBudgets() {
  return JSON.parse(readFileSync(BUDGETS_PATH, "utf8"));
}

// Returns null when no baseline has been recorded yet.
export function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

// Merge one section (latency | bundle) into the baseline, stamping app
// version and time, so recording one metric never wipes the other.
export function saveBaselineSection(section, data) {
  const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
  const baseline = loadBaseline() ?? {};
  baseline.appVersion = packageJson.version;
  baseline.recordedAt = new Date().toISOString();
  baseline[section] = data;
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  return BASELINE_PATH;
}
