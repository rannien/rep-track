// Refreshes lib/catalog-snapshot.json, the fallback lib/catalog-source.ts uses
// when the live wwworkout catalogue is unreachable. Run: pnpm catalog:sync
import { writeFileSync } from "node:fs";

const FIELDS = [
  "id",
  "name",
  "movement_pattern",
  "mechanics",
  "muscle_groups",
  "detail_url",
  "video_url",
];

const MAX_BYTES = 1_000_000;

const url = new URL("/api/exercises", process.env.WWWORKOUT_URL ?? "https://wwworkout.vercel.app");
if (url.protocol !== "https:" && url.hostname !== "localhost")
  throw new Error(`${url} must use https`);
const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
if (!response.ok) throw new Error(`${url} responded ${response.status}`);

const body = await response.text();
if (body.length > MAX_BYTES) throw new Error(`${url} returned more than ${MAX_BYTES} bytes`);
const { exercises } = JSON.parse(body);
if (!Array.isArray(exercises) || exercises.length === 0)
  throw new Error(`${url} returned no exercises`);

const snapshot = {
  exercises: exercises.map((exercise) =>
    Object.fromEntries(FIELDS.map((field) => [field, exercise[field]])),
  ),
};
writeFileSync(
  new URL("../lib/catalog-snapshot.json", import.meta.url),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);
console.log(`Wrote ${snapshot.exercises.length} exercises from ${url}`);
