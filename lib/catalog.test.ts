import { afterEach, describe, expect, it } from "vitest";
import snapshot from "./catalog-snapshot.json";
import {
  type CatalogExercise,
  DEFAULT_WWWORKOUT_URL,
  MAX_CATALOG_EXERCISES,
  catalogByName,
  isAllowedCatalogUrl,
  parseCatalog,
} from "./catalog";

const ORIGIN = new URL(DEFAULT_WWWORKOUT_URL).origin;

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "1",
    name: "Deadlift",
    movement_pattern: "bend",
    mechanics: "compound",
    muscle_groups: ["hamstrings", "glutes"],
    detail_url: "https://wwworkout.vercel.app/exercises/1",
    video_url: "https://www.youtube.com/results?search_query=Deadlift+form",
    ...overrides,
  };
}

function entry(id: string, name: string): CatalogExercise {
  return {
    id,
    name,
    movementPattern: "push",
    mechanics: "compound",
    muscleGroups: ["chest"],
    detailUrl: `https://wwworkout.vercel.app/exercises/${id}`,
    videoUrl: "https://www.youtube.com/",
  };
}

describe("parseCatalog", () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it("maps a valid row to camelCase fields", () => {
    const result = parseCatalog({ exercises: [row()] }, ORIGIN);

    expect(result).toEqual([
      {
        id: "1",
        name: "Deadlift",
        movementPattern: "bend",
        mechanics: "compound",
        muscleGroups: ["hamstrings", "glutes"],
        detailUrl: "https://wwworkout.vercel.app/exercises/1",
        videoUrl: "https://www.youtube.com/results?search_query=Deadlift+form",
      },
    ]);
  });

  it.each([
    ["numeric id", { id: 1 }],
    ["empty id", { id: "" }],
    ["blank name", { name: "   " }],
    ["missing name", { name: undefined }],
    ["unknown movement", { movement_pattern: "hinge" }],
    ["unknown mechanics", { mechanics: "accessory" }],
    ["empty muscle_groups", { muscle_groups: [] }],
    ["non-array muscle_groups", { muscle_groups: "chest" }],
    ["empty muscle name", { muscle_groups: ["chest", ""] }],
    ["non-string muscle", { muscle_groups: ["chest", 3] }],
    ["http detail_url", { detail_url: "http://wwworkout.vercel.app/exercises/1" }],
    ["javascript: video_url", { video_url: "javascript:alert(1)" }],
    ["unparseable video_url", { video_url: "not a url" }],
    ["detail_url on another https origin", { detail_url: "https://evil.example/exercises/1" }],
    ["detail_url on another port", { detail_url: "https://wwworkout.vercel.app:8443/exercises/1" }],
    ["video_url off YouTube", { video_url: "https://evil.example/watch?v=1" }],
    ["http YouTube video_url", { video_url: "http://www.youtube.com/watch?v=1" }],
  ])("drops only the row with %s", (_label, overrides) => {
    const body = { exercises: [row({ id: "a" }), row(overrides), row({ id: "b" })] };

    const result = parseCatalog(body, ORIGIN);

    expect(result.map((exercise) => exercise.id)).toEqual(["a", "b"]);
  });

  it("keeps a localhost detail_url when that is the expected origin", () => {
    const body = { exercises: [row({ detail_url: "http://localhost:3000/exercises/1" })] };

    const result = parseCatalog(body, "http://localhost:3000");

    expect(result.map((exercise) => exercise.detailUrl)).toEqual([
      "http://localhost:3000/exercises/1",
    ]);
  });

  it("drops a localhost detail_url when the expected origin is the default", () => {
    const body = { exercises: [row({ detail_url: "http://localhost:3000/exercises/1" })] };

    const result = parseCatalog(body, ORIGIN);

    expect(result).toEqual([]);
  });

  it("ignores rows beyond MAX_CATALOG_EXERCISES", () => {
    const rows = Array.from({ length: MAX_CATALOG_EXERCISES + 1 }, (_, i) => row({ id: `${i}` }));

    const result = parseCatalog({ exercises: rows }, ORIGIN);

    expect(result).toHaveLength(MAX_CATALOG_EXERCISES);
    expect(result.at(-1)?.id).toBe(`${MAX_CATALOG_EXERCISES - 1}`);
  });

  it("drops non-object rows", () => {
    const result = parseCatalog({ exercises: [null, "Deadlift", 7, [row()], row()] }, ORIGIN);

    expect(result).toHaveLength(1);
  });

  it.each([
    ["null", null],
    ["a string", "exercises"],
    ["a top-level array", [row()]],
    ["no exercises key", { items: [row()] }],
    ["non-array exercises", { exercises: { 0: row() } }],
  ])("returns no rows for %s", (_label, body) => {
    const result = parseCatalog(body, ORIGIN);

    expect(result).toEqual([]);
  });

  it("neither pollutes Object.prototype nor yields a row from a __proto__ row", () => {
    const body: unknown = JSON.parse(
      `{"exercises":[{"__proto__":${JSON.stringify(row({ polluted: true }))}}]}`,
    );

    const result = parseCatalog(body, ORIGIN);

    expect(result).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("ignores row fields that come only through the prototype", () => {
    const inherited = Object.create(row()) as object;

    const result = parseCatalog({ exercises: [inherited] }, ORIGIN);

    expect(result).toEqual([]);
  });

  it("ignores an exercises list that comes only through the prototype", () => {
    const body = Object.create({ exercises: [row()] }) as object;

    const result = parseCatalog(body, ORIGIN);

    expect(result).toEqual([]);
  });

  it("copies muscle_groups rather than aliasing the payload array", () => {
    const muscles = ["chest"];
    const [parsed] = parseCatalog({ exercises: [row({ muscle_groups: muscles })] }, ORIGIN);

    muscles.push("injected");

    expect(parsed.muscleGroups).toEqual(["chest"]);
  });

  it("parses the committed snapshot without dropping a row", () => {
    const result = parseCatalog(snapshot, ORIGIN);

    expect(result).toHaveLength(snapshot.exercises.length);
  });
});

describe("isAllowedCatalogUrl", () => {
  it.each(["https://example.com/x", "http://localhost:3000/x", "http://127.0.0.1/x"])(
    "accepts %s",
    (url) => {
      expect(isAllowedCatalogUrl(url)).toBe(true);
    },
  );

  it.each([
    "http://example.com/x",
    "http://localhost.example.com/x",
    "javascript:alert(1)",
    "data:text/html,x",
    "//example.com/x",
    "",
    42,
  ])("rejects %s", (url) => {
    expect(isAllowedCatalogUrl(url)).toBe(false);
  });
});

describe("catalogByName", () => {
  it("keys every entry by its name", () => {
    const byName = catalogByName([entry("1", "Deadlift"), entry("2", "Row")]);

    expect([...byName.keys()]).toEqual(["Deadlift", "Row"]);
  });

  it("keeps the first entry when a name repeats", () => {
    const byName = catalogByName([entry("1", "Deadlift"), entry("2", "Deadlift")]);

    expect(byName.get("Deadlift")?.id).toBe("1");
  });

  it("returns an empty map for an empty catalogue", () => {
    expect(catalogByName([]).size).toBe(0);
  });
});
