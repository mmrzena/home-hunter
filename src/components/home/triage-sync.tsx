"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth-client";
import {
  type TriageOp,
  type TriageSnapshot,
  triageStore,
} from "@/lib/triage-store";

/**
 * Headless bridge between the better-auth session and the triage store. It
 * fetches the server snapshot (TanStack Query), connects the store in remote
 * mode, and routes optimistic mutations back to the API. Integrating the
 * external triage store with React is the one fair use of useEffect here.
 *
 * The cached snapshot is kept in step with every op, because this component
 * remounts on each visit to the feed (Listings ↔ Analyse ↔ Contacted) and
 * re-seeds the store from the cache: a stale cache would silently drop the
 * likes and seens made since the first fetch.
 */

const TRIAGE_KEY = ["triage"] as const;

/** The snapshot after `op` — mirrors what the API does to the user's rows. */
function applyOp(snapshot: TriageSnapshot, op: TriageOp): TriageSnapshot {
  if (op.type === "clearSeen") return { ...snapshot, seen: [] };
  const seen = snapshot.seen.filter((id) => id !== op.clusterId);
  const shortlist = snapshot.shortlist.filter((id) => id !== op.clusterId);
  if (op.type === "set") {
    (op.state === "shortlist" ? shortlist : seen).push(op.clusterId);
  }
  return { seen, shortlist };
}

async function fetchSnapshot(): Promise<TriageSnapshot> {
  const response = await fetch("/api/triage");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<TriageSnapshot>;
}

async function sendOp(op: TriageOp): Promise<void> {
  const url =
    op.type === "delete"
      ? `/api/triage?clusterId=${op.clusterId}`
      : op.type === "clearSeen"
        ? "/api/triage?state=seen"
        : "/api/triage";
  const response = await fetch(url, {
    method: op.type === "set" ? "POST" : "DELETE",
    headers: op.type === "set" ? { "content-type": "application/json" } : {},
    body:
      op.type === "set"
        ? JSON.stringify({ clusterId: op.clusterId, state: op.state })
        : undefined,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function TriageSync() {
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user);
  const queryClient = useQueryClient();

  const snapshot = useQuery({
    queryKey: TRIAGE_KEY,
    queryFn: fetchSnapshot,
    enabled: isSignedIn,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationFn: sendOp,
    meta: { errorMessage: "Couldn't sync your triage." },
    // Mirror the op into the cached snapshot right away, so a remount re-seeds
    // the store from the state the user actually sees.
    onMutate: (op) => {
      queryClient.setQueryData<TriageSnapshot>(TRIAGE_KEY, (current) =>
        current ? applyOp(current, op) : current,
      );
    },
    // On failure, re-pull the server truth so optimistic state can't drift.
    onError: () => {
      void snapshot.refetch();
    },
  });

  const connected = useRef(false);
  // The snapshot the store was seeded from; a later, different one (a refetch
  // after a failed op, or another device's changes) is adopted as the truth.
  const seededWith = useRef<TriageSnapshot | null>(null);
  const { mutate } = mutation;
  const serverData = snapshot.data;

  useEffect(() => {
    if (
      isSignedIn &&
      serverData &&
      connected.current &&
      seededWith.current !== serverData
    ) {
      seededWith.current = serverData;
      triageStore.adopt(serverData);
    }
    if (isSignedIn && serverData && !connected.current) {
      connected.current = true;
      seededWith.current = serverData;

      // One-time migration: push any localStorage triage the server doesn't yet
      // know about, then merge so this device's hunt isn't lost on first login.
      const local = triageStore.exportLocal();
      const serverSeen = new Set(serverData.seen);
      const serverShortlist = new Set(serverData.shortlist);
      const isKnown = (id: number) =>
        serverSeen.has(id) || serverShortlist.has(id);

      const freshShortlist = local.shortlist.filter((id) => !isKnown(id));
      const freshSeen = local.seen.filter((id) => !isKnown(id));
      for (const clusterId of freshShortlist) {
        mutate({ type: "set", clusterId, state: "shortlist" });
      }
      for (const clusterId of freshSeen) {
        mutate({ type: "set", clusterId, state: "seen" });
      }

      triageStore.clearLocal();
      triageStore.connect(
        {
          seen: [...serverSeen, ...freshSeen],
          shortlist: [...serverShortlist, ...freshShortlist],
        },
        mutate,
      );
    }

    if (!isSignedIn && connected.current) {
      connected.current = false;
      triageStore.disconnect();
    }
  }, [isSignedIn, serverData, mutate]);

  return null;
}
