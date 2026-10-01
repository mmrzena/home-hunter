/**
 * Fetch JSON, throwing the server's `{ error }` message on a non-2xx response
 * so query/mutation error toasts say what went wrong.
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  return body;
}
