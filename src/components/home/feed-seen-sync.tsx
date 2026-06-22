"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth-client";
import { connectFeedSeen, disconnectFeedSeen } from "@/lib/feed-seen";

/**
 * Headless bridge between the better-auth session and the feed-seen store —
 * the sibling of TriageSync. Fetches the server mark, connects the store in
 * remote mode (merging any explicit local catch-up), and routes catch-ups back
 * to /api/feed-seen. Integrating the external store with React is the one fair
 * use of useEffect here.
 */

async function fetchFeedSeen(): Promise<number | null> {
  const response = await fetch("/api/feed-seen");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const data = (await response.json()) as { seenAt: number | null };
  return data.seenAt;
}

async function putFeedSeen(seenAt: number): Promise<void> {
  const response = await fetch("/api/feed-seen", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seenAt }),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function FeedSeenSync() {
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user);

  const snapshot = useQuery({
    queryKey: ["feed-seen"],
    queryFn: fetchFeedSeen,
    enabled: isSignedIn,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationFn: putFeedSeen,
    meta: { errorMessage: "Couldn't sync your feed mark." },
    // On failure, re-pull the server truth so optimistic state can't drift.
    onError: () => {
      void snapshot.refetch();
    },
  });

  const connected = useRef(false);
  const { mutate } = mutation;
  const serverData = snapshot.data;
  // null is a valid server value (no mark yet), so gate on success, not truthiness.
  const hasServerData = snapshot.isSuccess;

  useEffect(() => {
    if (isSignedIn && hasServerData && !connected.current) {
      connected.current = true;
      connectFeedSeen(serverData ?? null, (seenAt) => mutate(seenAt));
    }

    if (!isSignedIn && connected.current) {
      connected.current = false;
      disconnectFeedSeen();
    }
  }, [isSignedIn, hasServerData, serverData, mutate]);

  return null;
}
