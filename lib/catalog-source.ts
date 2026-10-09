import snapshot from "./catalog-snapshot.json";
import {
  DEFAULT_WWWORKOUT_URL,
  catalogByName,
  isAllowedCatalogUrl,
  parseCatalog,
  type CatalogExercise,
} from "./catalog";
import { enrichPlans, planDefinitions, type WorkoutPlan } from "./plans";

const CATALOG_REVALIDATE_SECONDS = 3600;
const CATALOG_TIMEOUT_MS = 5000;
const MAX_CATALOG_BYTES = 1_000_000;

function catalogUrl(): URL {
  const base = process.env.WWWORKOUT_URL ?? DEFAULT_WWWORKOUT_URL;
  if (!isAllowedCatalogUrl(base))
    throw new Error(`WWWORKOUT_URL must be an https URL, got "${base}"`);
  return new URL("/api/exercises", base);
}

// Resolved at module load so a malformed WWWORKOUT_URL fails the build, not a request.
const CATALOG_URL = catalogUrl();
const snapshotCatalog = catalogByName(
  parseCatalog(snapshot, new URL(DEFAULT_WWWORKOUT_URL).origin),
);

export class CatalogTooLargeError extends Error {
  name = "CatalogTooLargeError";
}

export async function readJsonWithLimit(response: Response, maxBytes: number): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > maxBytes) throw new CatalogTooLargeError();
  if (response.body === null) return null;
  let bytes = 0;
  const limited = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) controller.error(new CatalogTooLargeError());
        else controller.enqueue(chunk);
      },
    }),
  );
  return JSON.parse(await new Response(limited).text());
}

async function fetchLiveCatalog(): Promise<Map<string, CatalogExercise>> {
  const target = CATALOG_URL.toString();
  const startedAt = Date.now();
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      console.warn("catalog fetch failed", {
        target,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return new Map();
    }
    const live = catalogByName(
      parseCatalog(await readJsonWithLimit(response, MAX_CATALOG_BYTES), CATALOG_URL.origin),
    );
    if (live.size === 0) {
      console.warn("catalog had no valid exercises", {
        target,
        durationMs: Date.now() - startedAt,
      });
    }
    return live;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.warn("catalog fetch failed", { target, reason, durationMs: Date.now() - startedAt });
    return new Map();
  }
}

// Plans enriched from the live catalogue, falling back per exercise to the
// committed snapshot, so an unreachable wwworkout never breaks a build or page.
export async function getPlans(): Promise<WorkoutPlan[]> {
  return enrichPlans(planDefinitions, [await fetchLiveCatalog(), snapshotCatalog]);
}
