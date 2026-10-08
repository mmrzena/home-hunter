"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth-client";
import {
  connectFilterPrefs,
  disconnectFilterPrefs,
  type FilterPrefs,
} from "@/lib/filter-prefs";

/**
 * Headless bridge between the better-auth session and the filter-prefs store —
 * a sibling of TriageSync. Fetches the saved prefs, connects the store in remote
 * mode, restores the saved filter query into the URL when the feed opens
 * without one, and routes changes back to /api/filter-prefs.
 */

const PREFS_KEY = ["filter-prefs"] as const;

async function fetchPrefs(): Promise<FilterPrefs | null> {
  const response = await fetch("/api/filter-prefs");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const data = (await response.json()) as { prefs: FilterPrefs | null };
  return data.prefs;
}

async function putPrefs(prefs: FilterPrefs): Promise<void> {
  const response = await fetch("/api/filter-prefs", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(prefs),
    // A toggle right before closing the PWA must still reach the server.
    keepalive: true,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function FilterPrefsSync() {
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user);
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const snapshot = useQuery({
    queryKey: PREFS_KEY,
    queryFn: fetchPrefs,
    enabled: isSignedIn,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationFn: putPrefs,
    meta: { errorMessage: "Couldn't save your filters." },
    // Keep the cache current: this component remounts on every visit to the
    // feed and reconnects from it.
    onMutate: (prefs) => {
      queryClient.setQueryData(PREFS_KEY, prefs);
    },
  });

  const connected = useRef(false);
  const { mutate } = mutation;
  const serverData = snapshot.data;
  // null is a valid server value (nothing saved yet), so gate on success.
  const hasServerData = snapshot.isSuccess;

  useEffect(() => {
    if (isSignedIn && hasServerData && !connected.current) {
      connected.current = true;
      const saved = connectFilterPrefs(serverData ?? null, mutate);
      // Opening the feed bare restores the profile's filters; an explicit query
      // (a shared link, a back-navigation) wins over the saved one.
      if (saved && window.location.search === "") {
        window.history.replaceState(null, "", `${pathname}?${saved}`);
      }
    }

    if (!isSignedIn && connected.current) {
      connected.current = false;
      disconnectFilterPrefs();
    }
  }, [isSignedIn, hasServerData, serverData, mutate, pathname]);

  return null;
}
