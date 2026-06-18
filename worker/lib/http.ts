import { setTimeout as sleep } from "node:timers/promises";

// A realistic browser UA + a polite identifier. We hit undocumented public
// endpoints for single-user personal research: low concurrency, a request
// delay, and aggressive caching upstream keep this in the gray-area-but-OK lane.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 home-hunter/0.1 (personal research)";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/**
 * GET JSON with exponential backoff on 429 / 5xx. Throws HttpError on a
 * non-retryable status or after exhausting retries.
 */
export async function getJson<T = unknown>(
  url: string,
  options: { retries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { retries = 3, headers = {} } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...headers,
        },
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status !== 429 && response.status < 500) {
        throw new HttpError(response.status, url);
      }
      lastError = new HttpError(response.status, url);
    } catch (error) {
      lastError = error;
      if (
        error instanceof HttpError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

/**
 * POST JSON with the same backoff policy as getJson — for GraphQL endpoints
 * (Bezrealitky). Sends and expects JSON; throws HttpError on a non-retryable
 * status or after exhausting retries.
 */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  options: { retries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { retries = 3, headers = {} } = options;
  const payload = JSON.stringify(body);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...headers,
        },
        body: payload,
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status !== 429 && response.status < 500) {
        throw new HttpError(response.status, url);
      }
      lastError = new HttpError(response.status, url);
    } catch (error) {
      lastError = error;
      if (
        error instanceof HttpError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

/**
 * GET an HTML/text page with the same backoff policy as getJson — for sources
 * scraped from rendered markup (České reality). Returns the response body text.
 */
export async function getText(
  url: string,
  options: { retries?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const { retries = 3, headers = {} } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
          ...headers,
        },
      });
      if (response.ok) return await response.text();
      if (response.status !== 429 && response.status < 500) {
        throw new HttpError(response.status, url);
      }
      lastError = new HttpError(response.status, url);
    } catch (error) {
      lastError = error;
      if (
        error instanceof HttpError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

/** GET an image as a Buffer (for in-memory hashing). Returns null on failure. */
export async function getImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** Inter-request pacing for a single source. */
export function throttle(delayMs: number) {
  let last = 0;
  return async () => {
    const wait = delayMs - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}
