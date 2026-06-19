"use client";

import { useSyncExternalStore } from "react";

/**
 * Triage state — which clusters you've shortlisted (★) or marked seen.
 *
 * Two modes, one synchronous interface so the UI never branches:
 * - **local** (signed out): persisted to localStorage, exactly as before.
 * - **remote** (signed in): the server is the source of truth. `connect()`
 *   seeds the in-memory state from the server and installs a `push` callback;
 *   every mutation then optimistically updates memory and fires the matching
 *   op at the API. localStorage is left untouched while remote.
 *
 * A tiny external store subscribed to via useSyncExternalStore — no dependency,
 * SSR-safe, one subscription drives the whole feed.
 */

export type TriageView = "all" | "shortlist" | "hidden";

// The DB-side names ("seen" === the "hidden" set in the UI).
export type TriageStateName = "seen" | "shortlist";

export type TriageSnapshot = { seen: number[]; shortlist: number[] };

export type TriageOp =
  | { type: "set"; clusterId: number; state: TriageStateName }
  | { type: "delete"; clusterId: number }
  | { type: "clearSeen" };

type TriageState = {
  shortlisted: ReadonlySet<number>;
  hidden: ReadonlySet<number>;
};

const STORAGE_KEY = "home-hunter:triage:v1";
const EMPTY: TriageState = { shortlisted: new Set(), hidden: new Set() };

let state: TriageState = EMPTY;
let mode: "local" | "remote" = "local";
let push: ((op: TriageOp) => void) | null = null;
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

function emit() {
  for (const listener of listeners) listener();
}

function apply(next: TriageState) {
  state = next;
  // Persist locally only while signed out; remote mode trusts the server.
  if (mode === "local" && typeof window !== "undefined") {
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
  emit();
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
    // Skipped once connected — remote state must not be clobbered by localStorage.
    if (!hydrated && mode === "local") {
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
    const wasShortlisted = state.shortlisted.has(id);
    const shortlisted = withToggled(state.shortlisted, id);
    // Shortlisting un-hides — the two are mutually exclusive intents.
    const hidden = new Set(state.hidden);
    if (shortlisted.has(id)) hidden.delete(id);
    apply({ shortlisted, hidden });
    push?.(
      wasShortlisted
        ? { type: "delete", clusterId: id }
        : { type: "set", clusterId: id, state: "shortlist" },
    );
  },
  hide(id: number) {
    const hidden = new Set(state.hidden).add(id);
    const shortlisted = new Set(state.shortlisted);
    shortlisted.delete(id);
    apply({ shortlisted, hidden });
    push?.({ type: "set", clusterId: id, state: "seen" });
  },
  unhide(id: number) {
    const hidden = new Set(state.hidden);
    hidden.delete(id);
    apply({ ...state, hidden });
    push?.({ type: "delete", clusterId: id });
  },
  clearHidden() {
    apply({ ...state, hidden: new Set() });
    push?.({ type: "clearSeen" });
  },

  /** Switch to remote mode: adopt the server snapshot and route writes to `pusher`. */
  connect(snapshot: TriageSnapshot, pusher: (op: TriageOp) => void) {
    mode = "remote";
    push = pusher;
    state = {
      shortlisted: new Set(snapshot.shortlist),
      hidden: new Set(snapshot.seen),
    };
    emit();
  },
  /** Back to signed-out: drop the remote writer and re-read localStorage. */
  disconnect() {
    mode = "local";
    push = null;
    state = load();
    emit();
  },
  /** Snapshot of the current localStorage triage, for one-time migration on first login. */
  exportLocal(): TriageSnapshot {
    const local = load();
    return { seen: [...local.hidden], shortlist: [...local.shortlisted] };
  },
  clearLocal() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore — nothing actionable if removal fails.
      }
    }
  },
};

export function useTriage(): TriageState {
  return useSyncExternalStore(
    triageStore.subscribe,
    triageStore.getSnapshot,
    triageStore.getServerSnapshot,
  );
}
