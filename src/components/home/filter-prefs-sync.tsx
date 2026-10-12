"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth-client";
import {
  adoptFilterPrefs,
  connectFilterPrefs,
  disconnectFilterPrefs,
  type FilterPrefs,
} from "@/lib/filter-prefs";

/**
 * Headless bridge between the better-auth session and the filter-prefs store —
 * a sibling of TriageSync. Fetches the saved prefs, connects the store in remote
 * mode, keeps the feed's URL on the saved filter query, and routes changes back
 * to /api/filter-prefs.
 *
 * The profile is the truth across devices: the prefs are refetched whenever
 * the feed mounts or regains focus (a PWA coming back from the background), and
 * prefs saved elsewhere replace the ones on this device — including a stale
 * query the PWA restored into the URL. Saves run one at a time so a quick
 * series of toggles can't land on the server out of order.
 */

const PREFS_KEY = ["filter-prefs"] as const;

async function fetchPrefs({
  signal,
}: {
  signal: AbortSignal;
}): Promise<FilterPrefs | null> {
  const response = await fetch("/api/filter-prefs", { signal });
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

function replaceQuery(pathname: string, query: string) {
  const current = window.location.search.replace(/^\?/, "");
  if (current === query) return;
  window.history.replaceState(
    null,
    "",
    query ? `${pathname}?${query}` : pathname,
  );
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
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });

  const mutation = useMutation({
    mutationFn: putPrefs,
    meta: { errorMessage: "Couldn't save your filters." },
    // Serialise saves: the last toggle must be the last write on the server.
    scope: { id: "filter-prefs" },
    onMutate: async (prefs) => {
      // A fetch in flight would come back with the pre-save prefs and undo
      // this change; the cache mirrors what was just saved instead.
      await queryClient.cancelQueries({ queryKey: PREFS_KEY });
      queryClient.setQueryData(PREFS_KEY, prefs);
    },
    onSettled: (_data, _error, prefs) => {
      queryClient.setQueryData(PREFS_KEY, prefs);
    },
  });

  const connected = useRef(false);
  const { mutate, isPending } = mutation;
  const serverData = snapshot.data;
  // null is a valid server value (nothing saved yet), so gate on success.
  const hasServerData = snapshot.isSuccess;

  useEffect(() => {
    if (!isSignedIn) {
      if (connected.current) {
        connected.current = false;
        disconnectFilterPrefs();
      }
      return;
    }
    if (!hasServerData) return;

    if (!connected.current) {
      connected.current = true;
      const urlQuery = window.location.search.replace(/^\?/, "");
      const saved = connectFilterPrefs(serverData ?? null, mutate, urlQuery);
      replaceQuery(pathname, saved);
      return;
    }

    // While a save is on its way, the cache (not the server) is the truth.
    if (isPending) return;
    const adopted = adoptFilterPrefs(serverData ?? null);
    if (adopted !== null) replaceQuery(pathname, adopted);
  }, [isSignedIn, hasServerData, serverData, mutate, isPending, pathname]);

  return null;
}
