import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const SW_SOURCE = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
const ORIGIN = "https://rep-track.test";

interface FakeResponse {
  ok: boolean;
  redirected: boolean;
  label: string;
  clone: () => FakeResponse;
}

interface FakeRequest {
  method: string;
  url: string;
  mode: string;
}

interface FakeFetchEvent {
  request: FakeRequest;
  respondWith: (response: Promise<unknown>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}

type FetchListener = (event: FakeFetchEvent) => void;

type FakeFetch = (request: FakeRequest, init?: { signal?: AbortSignal }) => Promise<FakeResponse>;

function fakeResponse(label: string, init: { ok?: boolean; redirected?: boolean } = {}) {
  const response: FakeResponse = {
    ok: init.ok ?? true,
    redirected: init.redirected ?? false,
    label,
    clone: () => ({ ...response, label: `${label} (clone)` }),
  };
  return response;
}

const ERROR_RESPONSE = fakeResponse("Response.error()", { ok: false });

function installServiceWorker(options: { cached: Record<string, FakeResponse>; fetch: FakeFetch }) {
  const listeners = new Map<string, FetchListener>();
  const put = vi.fn<(request: FakeRequest, response: FakeResponse) => Promise<void>>(
    async () => {},
  );
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: FetchListener) => listeners.set(type, listener),
  };
  const caches = {
    match: async (request: FakeRequest | string) =>
      options.cached[typeof request === "string" ? request : new URL(request.url).pathname],
    open: async () => ({ put }),
  };
  const fetch = vi.fn(options.fetch);
  const navigationTimeout = new AbortController();
  const timeout = vi.fn((_ms: number) => navigationTimeout.signal);
  new Function("self", "caches", "fetch", "Response", "AbortSignal", SW_SOURCE)(
    self,
    caches,
    fetch,
    { error: () => ERROR_RESPONSE },
    { timeout },
  );

  function dispatch(request: FakeRequest) {
    let response: Promise<unknown> | undefined;
    const pending: Promise<unknown>[] = [];
    listeners.get("fetch")?.({
      request,
      respondWith: (promise) => {
        response = promise;
      },
      waitUntil: (work) => {
        pending.push(work.catch(() => undefined));
      },
    });
    return { response, settled: () => Promise.all(pending) };
  }

  return {
    dispatch,
    put,
    fetch,
    timeout,
    expireNavigationTimeout: () => navigationTimeout.abort(),
  };
}

function navigation(path: string): FakeRequest {
  return { method: "GET", url: `${ORIGIN}${path}`, mode: "navigate" };
}

const never = () => new Promise<FakeResponse>(() => {});
const untilAborted: FakeFetch = (_request, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
const stillPending = () => new Promise((resolve) => setTimeout(() => resolve("still pending"), 0));

describe("service worker navigations", () => {
  it("serves the cached page without waiting for the network", async () => {
    const cachedPage = fakeResponse("cached /history");
    const sw = installServiceWorker({ cached: { "/history": cachedPage }, fetch: never });

    const { response } = sw.dispatch(navigation("/history"));

    await expect(Promise.race([response, stillPending()])).resolves.toBe(cachedPage);
  });

  it("refreshes the cached page from the network in the background", async () => {
    const request = navigation("/history");
    const sw = installServiceWorker({
      cached: { "/history": fakeResponse("cached /history") },
      fetch: async () => fakeResponse("fresh /history"),
    });

    const { settled } = sw.dispatch(request);
    await settled();

    expect(sw.fetch).toHaveBeenCalledWith(request, expect.anything());
    expect(sw.put).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ label: "fresh /history (clone)" }),
    );
  });

  it("returns and stores the network page when nothing is cached", async () => {
    const request = navigation("/stats");
    const freshPage = fakeResponse("fresh /stats");
    const sw = installServiceWorker({ cached: {}, fetch: async () => freshPage });

    const { response, settled } = sw.dispatch(request);
    await settled();

    await expect(response).resolves.toBe(freshPage);
    expect(sw.put).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ label: "fresh /stats (clone)" }),
    );
  });

  it("falls back to the cached app shell when offline and the page is not cached", async () => {
    const shell = fakeResponse("cached /");
    const sw = installServiceWorker({
      cached: { "/": shell },
      fetch: () => Promise.reject(new TypeError("offline")),
    });

    const { response } = sw.dispatch(navigation("/records"));

    await expect(response).resolves.toBe(shell);
  });

  it("serves the cached app shell once a hanging navigation times out", async () => {
    const shell = fakeResponse("cached /");
    const sw = installServiceWorker({ cached: { "/": shell }, fetch: untilAborted });

    const { response, settled } = sw.dispatch(navigation("/records"));
    sw.expireNavigationTimeout();

    await expect(Promise.race([response, stillPending()])).resolves.toBe(shell);
    await settled();
    expect(sw.timeout).toHaveBeenCalledWith(10_000);
    expect(sw.put).not.toHaveBeenCalled();
  });

  it("returns a network error when offline and nothing is cached", async () => {
    const sw = installServiceWorker({
      cached: {},
      fetch: () => Promise.reject(new TypeError("offline")),
    });

    const { response, settled } = sw.dispatch(navigation("/records"));
    await settled();

    await expect(response).resolves.toBe(ERROR_RESPONSE);
    expect(sw.put).not.toHaveBeenCalled();
  });

  it("returns a server error page without caching it", async () => {
    const errorPage = fakeResponse("500 /compare", { ok: false });
    const sw = installServiceWorker({ cached: {}, fetch: async () => errorPage });

    const { response, settled } = sw.dispatch(navigation("/compare"));
    await settled();

    await expect(response).resolves.toBe(errorPage);
    expect(sw.put).not.toHaveBeenCalled();
  });

  it("does not cache a redirected response", async () => {
    const redirectedPage = fakeResponse("redirected /settings", { redirected: true });
    const sw = installServiceWorker({ cached: {}, fetch: async () => redirectedPage });

    const { response, settled } = sw.dispatch(navigation("/settings"));
    await settled();

    await expect(response).resolves.toBe(redirectedPage);
    expect(sw.put).not.toHaveBeenCalled();
  });

  it("leaves non-GET requests to the browser", () => {
    const sw = installServiceWorker({ cached: {}, fetch: never });

    const { response } = sw.dispatch({ ...navigation("/"), method: "POST" });

    expect(response).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});
