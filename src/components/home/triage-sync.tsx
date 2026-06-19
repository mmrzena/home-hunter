"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
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
 */

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

  const snapshot = useQuery({
    queryKey: ["triage"],
    queryFn: fetchSnapshot,
    enabled: isSignedIn,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationFn: sendOp,
    meta: { errorMessage: "Couldn't sync your triage." },
    // On failure, re-pull the server truth so optimistic state can't drift.
    onError: () => {
      void snapshot.refetch();
    },
  });

  const connected = useRef(false);
  const { mutate } = mutation;
  const serverData = snapshot.data;

  useEffect(() => {
    if (isSignedIn && serverData && !connected.current) {
      connected.current = true;

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
