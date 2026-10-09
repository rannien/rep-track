import type { Movement } from "./workouts";

// One exercise from the wwworkout catalogue API (GET /api/exercises), reduced
// to what rep-track uses.
export type CatalogExercise = {
  id: string;
  name: string;
  movementPattern: Movement;
  mechanics: "compound" | "isolation";
  muscleGroups: string[];
  detailUrl: string;
  videoUrl: string;
};

const MOVEMENTS: readonly Movement[] = ["push", "pull", "bend", "squat", "lunge", "flex"];
const MECHANICS = ["compound", "isolation"] as const;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const VIDEO_ORIGIN = "https://www.youtube.com";

export const DEFAULT_WWWORKOUT_URL = "https://wwworkout.vercel.app";
export const MAX_CATALOG_EXERCISES = 1000;

// Own properties only, so a payload can never reach Object.prototype through
// a "__proto__" or "constructor" key.
function ownValue(record: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// https only; plain http is accepted for a local catalogue during development.
export function isAllowedCatalogUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

function hasOrigin(value: unknown, origin: string): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

function parseCatalogExercise(value: unknown, detailOrigin: string): CatalogExercise | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const id = ownValue(value, "id");
  const name = ownValue(value, "name");
  const movementPattern = MOVEMENTS.find(
    (movement) => movement === ownValue(value, "movement_pattern"),
  );
  const mechanics = MECHANICS.find((kind) => kind === ownValue(value, "mechanics"));
  const muscleGroups = ownValue(value, "muscle_groups");
  const detailUrl = ownValue(value, "detail_url");
  const videoUrl = ownValue(value, "video_url");

  if (!isNonEmptyString(id) || !isNonEmptyString(name)) return null;
  if (movementPattern === undefined || mechanics === undefined) return null;
  if (
    !Array.isArray(muscleGroups) ||
    muscleGroups.length === 0 ||
    !muscleGroups.every(isNonEmptyString)
  )
    return null;
  if (!hasOrigin(detailUrl, detailOrigin) || !hasOrigin(videoUrl, VIDEO_ORIGIN)) return null;

  return {
    id,
    name,
    movementPattern,
    mechanics,
    muscleGroups: [...muscleGroups],
    detailUrl,
    videoUrl,
  };
}

// The API response is a trust boundary: invalid rows are dropped one by one, detail links must
// stay on the catalogue's origin and videos on YouTube; a non-{ exercises: [...] } body yields [].
export function parseCatalog(body: unknown, detailOrigin: string): CatalogExercise[] {
  if (typeof body !== "object" || body === null) return [];
  const exercises = ownValue(body, "exercises");
  if (!Array.isArray(exercises)) return [];
  return exercises
    .slice(0, MAX_CATALOG_EXERCISES)
    .map((exercise) => parseCatalogExercise(exercise, detailOrigin))
    .filter((exercise) => exercise !== null);
}

// First entry wins if the catalogue ever repeats a name.
export function catalogByName(exercises: CatalogExercise[]): Map<string, CatalogExercise> {
  const byName = new Map<string, CatalogExercise>();
  for (const exercise of exercises) {
    if (!byName.has(exercise.name)) byName.set(exercise.name, exercise);
  }
  return byName;
}
