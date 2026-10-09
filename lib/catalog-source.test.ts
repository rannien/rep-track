import { describe, expect, it } from "vitest";
import { CatalogTooLargeError, readJsonWithLimit } from "./catalog-source";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readJsonWithLimit", () => {
  it("parses a small JSON body", async () => {
    const response = new Response('{"exercises":[]}');

    const result = await readJsonWithLimit(response, 1000);

    expect(result).toEqual({ exercises: [] });
  });

  it("rejects when the content-length header exceeds the limit", async () => {
    const response = new Response("{}", { headers: { "content-length": "11" } });

    const result = readJsonWithLimit(response, 10);

    await expect(result).rejects.toBeInstanceOf(CatalogTooLargeError);
  });

  it("rejects a streamed body over the limit that has no content-length", async () => {
    const response = new Response(streamOf('{"a":"', "x".repeat(10), '"}'));

    const result = readJsonWithLimit(response, 12);

    await expect(result).rejects.toBeInstanceOf(CatalogTooLargeError);
  });

  it("accepts a body exactly at the limit", async () => {
    const body = '{"a":"xxxx"}';
    const response = new Response(streamOf(body));

    const result = await readJsonWithLimit(response, body.length);

    expect(result).toEqual({ a: "xxxx" });
  });

  it("counts bytes rather than characters", async () => {
    const response = new Response(streamOf('"é"'));

    const result = readJsonWithLimit(response, 3);

    await expect(result).rejects.toBeInstanceOf(CatalogTooLargeError);
  });

  it("returns null for a response without a body", async () => {
    const response = new Response(null);

    const result = await readJsonWithLimit(response, 1000);

    expect(result).toBeNull();
  });

  it("rejects invalid JSON with a SyntaxError", async () => {
    const response = new Response("{not json");

    const result = readJsonWithLimit(response, 1000);

    await expect(result).rejects.toBeInstanceOf(SyntaxError);
  });
});
