"use client";

import { useSyncExternalStore } from "react";

/**
 * "New since you last caught up" — a persistent, inbox-style high-water mark.
 *
 * `seenThrough` is the moment you last acknowledged the feed. A listing counts
 * as new until its first-seen time is no later than the mark. The mark advances
 * ONLY when you explicitly catch up (`markFeedSeen`) — never on a page load — so
 * a refresh leaves the unread count exactly where it was. Persisted to
 * localStorage; "what I've seen on this device" is inherently per-device, like
 * triage when signed out.
 */

const KEY = "home-hunter:feed-seen:v1";

let seenThrough: number | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    // Private mode / quota — the mark still lives in memory for this session.
  }
}

function subscribe(listener: () => void) {
  // Lazy hydrate on the first browser subscription (mirrors the triage store),
  // so SSR and the first client render agree on null and there's no mismatch.
  if (!hydrated) {
    hydrated = true;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          seenThrough = Number(raw);
        } else {
          // First-ever visit: start the clock now, exactly once, so only
          // genuinely later arrivals are ever counted as new.
          seenThrough = Date.now();
          persist(seenThrough);
        }
      } catch {
        seenThrough = null;
      }
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mark the feed caught up as of now — clears the unread count. */
export function markFeedSeen() {
  seenThrough = Date.now();
  persist(seenThrough);
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
