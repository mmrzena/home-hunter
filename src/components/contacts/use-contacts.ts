"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Contact, ContactSave } from "@/lib/contacts";
import { fetchJson } from "@/lib/fetch-json";

const CONTACTS_KEY = ["contacts"] as const;

/** The user's contacted houses, newest edit first. Read via ContactsProvider. */
export function useContactsQuery(canUse: boolean) {
  return useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: () =>
      fetchJson<{ contacts: Contact[] }>("/api/contacts").then(
        (body) => body.contacts,
      ),
    enabled: canUse,
    meta: { errorMessage: "Couldn't load your contacted houses." },
  });
}

/**
 * Each mutation patches the cached list from what it already knows so the UI
 * reacts as soon as the write lands, then refetches in the background (not
 * awaited) for what only the server computes: `current` and `events`.
 */
export function useSaveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (save: ContactSave) =>
      fetchJson<{ contact: Contact }>("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(save),
      }),
    onSuccess: ({ contact }) => {
      queryClient.setQueryData<Contact[]>(CONTACTS_KEY, (contacts) => {
        if (!contacts) return undefined;
        const previous = contacts.find((entry) => entry.id === contact.id);
        const merged = {
          ...contact,
          current: previous?.current ?? null,
          events: previous?.events ?? [],
        };
        return previous
          ? contacts.map((entry) => (entry.id === contact.id ? merged : entry))
          : [merged, ...contacts];
      });
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
    meta: { errorMessage: "Couldn't save the contact." },
  });
}

export type FollowUp = { id: number; note: string };

/** Logs a chase-up (and what it was) on a contact, which also takes it off the waiting list. */
export function useFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (followUp: FollowUp) =>
      fetchJson("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(followUp),
      }),
    onSuccess: (_, { id }) => {
      const updatedAt = new Date().toISOString();
      queryClient.setQueryData<Contact[]>(CONTACTS_KEY, (contacts) =>
        contacts?.map((entry) =>
          entry.id === id ? { ...entry, updatedAt } : entry,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
    meta: { errorMessage: "Couldn't log the follow-up." },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/api/contacts?id=${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Contact[]>(CONTACTS_KEY, (contacts) =>
        contacts?.filter((entry) => entry.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
    meta: { errorMessage: "Couldn't delete the contact." },
  });
}
