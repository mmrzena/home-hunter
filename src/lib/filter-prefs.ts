"use client";

import { useSyncExternalStore } from "react";

import type { FilterPrefs } from "@/db/schema";

export type { FilterPrefs };

/**
 * The filter bar's remembered state: which filter controls are hidden, plus
 * the last committed filter query. The URL stays the source of truth for the
 * *active* filters; this store only remembers them so a signed-in profile can
 * restore them on the next device (or the next visit to the feed).
 *
 * Two backends, one synchronous interface (mirrors the triage store):
 * - **local** (signed out): the hidden set lives in localStorage, device-local;
 *   the query is not remembered.
 * - **remote** (signed in): `user.filter_prefs` is the source of truth. Every
 *   change pushes the whole prefs object to `/api/filter-prefs`.
 */

const HIDDEN_KEY = "home-hunter:hidden-filters:v1";
const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

let hidden: ReadonlySet<string> = EMPTY_HIDDEN;
let query = "";
let mode: "local" | "remote" = "local";
let push: ((prefs: FilterPrefs) => void) | null = null;
// Set once the user commits a query this session, so a toggle made before the
// profile finished loading is not overwritten by the saved one on connect.
let isQueryDirty = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readLocalHidden(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY_HIDDEN;
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (!raw) return EMPTY_HIDDEN;
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return EMPTY_HIDDEN;
  }
}

function persist() {
  if (mode === "remote") {
    push?.({ query, hidden: [...hidden] });
    return;
  }
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // Private mode / quota — the set still lives in memory for this session.
  }
}

function subscribe(listener: () => void) {
  // Lazy hydrate on the first browser subscription so SSR and the first client
  // render agree on an empty set. Skipped once connected.
  if (!hydrated && mode === "local") {
    hydrated = true;
    hidden = readLocalHidden();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hide or show one filter control in the bar. */
export function toggleHiddenFilter(key: string) {
  const next = new Set(hidden);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  hidden = next;
  persist();
  emit();
}

/** Remember the filter query the bar just committed (the URL's search string). */
export function rememberFilterQuery(next: string) {
  isQueryDirty = true;
  if (next === query) return;
  query = next;
  persist();
}

/**
 * Switch to remote mode: adopt the server prefs and route writes to `pusher`.
 * Returns the saved query so the caller can restore it into the URL. On a
 * reconnect (the feed remounted) the in-memory state is already the truth and
 * is kept. A query the user committed while the profile was still loading
 * wins over the saved one and is pushed right away.
 */
export function connectFilterPrefs(
  server: FilterPrefs | null,
  pusher: (prefs: FilterPrefs) => void,
): string {
  const wasLocal = mode !== "remote";
  mode = "remote";
  push = pusher;
  if (wasLocal) {
    hidden = new Set(server?.hidden ?? []);
    if (isQueryDirty) persist();
    else query = server?.query ?? "";
  }
  emit();
  return query;
}

/** Back to signed-out: drop the remote writer and re-read the local hidden set. */
export function disconnectFilterPrefs() {
  mode = "local";
  push = null;
  query = "";
  isQueryDirty = false;
  hidden = readLocalHidden();
  emit();
}

/** The set of hidden filter controls (empty before hydration / SSR). */
export function useHiddenFilters(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => EMPTY_HIDDEN,
  );
}
