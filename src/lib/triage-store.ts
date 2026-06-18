"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only triage state — which clusters you've shortlisted (★) or hidden,
 * persisted to localStorage so a hunt survives reloads. The app is read-only
 * over Postgres, so this lives entirely in the browser: a tiny external store
 * subscribed to via useSyncExternalStore (no dependency, SSR-safe, and a single
 * subscription drives the whole feed).
 */

export type TriageView = "all" | "shortlist" | "hidden";

type TriageState = {
  shortlisted: ReadonlySet<number>;
  hidden: ReadonlySet<number>;
};

const STORAGE_KEY = "home-hunter:triage:v1";
const EMPTY: TriageState = { shortlisted: new Set(), hidden: new Set() };

let state: TriageState = EMPTY;
const listeners = new Set<() => void>();

function load(): TriageState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const record = parsed as { shortlisted?: unknown; hidden?: unknown };
    const toSet = (value: unknown): Set<number> =>
      new Set(
        Array.isArray(value)
          ? value.filter((entry): entry is number => typeof entry === "number")
          : [],
      );
    return {
      shortlisted: toSet(record.shortlisted),
      hidden: toSet(record.hidden),
    };
  } catch {
    return EMPTY;
  }
}

function persist(next: TriageState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          shortlisted: [...next.shortlisted],
          hidden: [...next.hidden],
        }),
      );
    } catch {
      // localStorage can throw (private mode, quota) — state still updates in-memory.
    }
  }
  for (const listener of listeners) listener();
}

function withToggled(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

let hydrated = false;

export const triageStore = {
  subscribe(listener: () => void) {
    // Lazily hydrate from localStorage on the first browser subscription so the
    // server and first client render agree on EMPTY (no hydration mismatch).
    if (!hydrated) {
      hydrated = true;
      const loaded = load();
      if (loaded !== EMPTY) state = loaded;
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,
  getServerSnapshot: () => EMPTY,

  toggleShortlist(id: number) {
    const shortlisted = withToggled(state.shortlisted, id);
    // Shortlisting un-hides — the two are mutually exclusive intents.
    const hidden = new Set(state.hidden);
    if (shortlisted.has(id)) hidden.delete(id);
    persist({ shortlisted, hidden });
  },
  hide(id: number) {
    const hidden = new Set(state.hidden).add(id);
    const shortlisted = new Set(state.shortlisted);
    shortlisted.delete(id);
    persist({ shortlisted, hidden });
  },
  unhide(id: number) {
    const hidden = new Set(state.hidden);
    hidden.delete(id);
    persist({ ...state, hidden });
  },
  clearHidden() {
    persist({ ...state, hidden: new Set() });
  },
};

export function useTriage(): TriageState {
  return useSyncExternalStore(
    triageStore.subscribe,
    triageStore.getSnapshot,
    triageStore.getServerSnapshot,
  );
}
