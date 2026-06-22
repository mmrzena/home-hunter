"use client";

import { useSyncExternalStore } from "react";

/**
 * "New since you last caught up" — a persistent, inbox-style high-water mark.
 *
 * `seenThrough` is the moment you last acknowledged the feed; a listing counts
 * as new until its first-seen time is no later than the mark. The mark advances
 * ONLY when you explicitly catch up (`markFeedSeen`) — never on a page load — so
 * a refresh leaves the unread count where it was.
 *
 * Two backends, one synchronous interface (mirrors the triage store):
 * - **local** (signed out): persisted to localStorage, device-local.
 * - **remote** (signed in): the `user.feed_seen_at` column is the source of
 *   truth, so the mark follows you across phone + web. `connectFeedSeen` adopts
 *   the server value and routes catch-ups to `/api/feed-seen`.
 *
 * The first-ever visit auto-stamps "now" so a fresh load doesn't flag the whole
 * catalog as new. That auto-stamp is tracked separately from an explicit
 * catch-up, so signing in on a brand-new device can't overwrite a mark you set
 * elsewhere — only a real catch-up ever beats the server in the merge.
 */

const KEY = "home-hunter:feed-seen:v1";
const EXPLICIT_KEY = "home-hunter:feed-seen-explicit:v1";

let seenThrough: number | null = null;
let mode: "local" | "remote" = "local";
let push: ((seenAt: number) => void) | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readLocal(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function readExplicit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EXPLICIT_KEY) === "1";
  } catch {
    return false;
  }
}

function persistLocal(value: number, explicit: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(value));
    if (explicit) window.localStorage.setItem(EXPLICIT_KEY, "1");
  } catch {
    // Private mode / quota — the mark still lives in memory for this session.
  }
}

// The local mark, or "now" stamped exactly once on a first-ever visit (auto, not
// explicit) so a first load counts only genuinely later arrivals as new.
function hydrateLocal(): number | null {
  if (typeof window === "undefined") return null;
  const existing = readLocal();
  if (existing != null) return existing;
  const now = Date.now();
  persistLocal(now, false);
  return now;
}

function subscribe(listener: () => void) {
  // Lazy hydrate on the first browser subscription (mirrors the triage store),
  // so SSR and the first client render agree on null. Skipped once connected —
  // remote state must not be clobbered by localStorage.
  if (!hydrated && mode === "local") {
    hydrated = true;
    seenThrough = hydrateLocal();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mark the feed caught up as of now — clears the unread count. */
export function markFeedSeen() {
  seenThrough = Date.now();
  if (mode === "local") persistLocal(seenThrough, true);
  else push?.(seenThrough);
  emit();
}

/**
 * Switch to remote mode: merge the server mark with any explicit local catch-up
 * (most-recent wins, so neither device regresses), then route writes to `pusher`.
 * A first-visit auto-stamp is ignored here — only an explicit catch-up counts.
 */
export function connectFeedSeen(
  serverSeenAt: number | null,
  pusher: (seenAt: number) => void,
) {
  const explicitLocal = readExplicit() ? readLocal() : null;
  let merged = Math.max(serverSeenAt ?? 0, explicitLocal ?? 0) || null;
  // Brand-new everywhere: establish the baseline now so the next device inherits it.
  if (merged == null) merged = Date.now();

  mode = "remote";
  push = pusher;
  seenThrough = merged;
  if (merged !== serverSeenAt) pusher(merged);
  emit();
}

/** Back to signed-out: drop the remote writer and fall back to the local mark. */
export function disconnectFeedSeen() {
  mode = "local";
  push = null;
  seenThrough = hydrateLocal();
  emit();
}

/** The catch-up high-water mark (ms epoch), or null before hydration / SSR. */
export function useFeedSeen(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => seenThrough,
    () => null,
  );
}

/** A friendly "since …" label for the mark: yesterday, a weekday, or a date. */
export function sinceLabel(timestamp: number): string {
  const then = new Date(timestamp);
  const now = new Date();
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
