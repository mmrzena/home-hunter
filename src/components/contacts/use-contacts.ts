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

export function useSaveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (save: ContactSave) =>
      fetchJson("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(save),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
    meta: { errorMessage: "Couldn't save the contact." },
  });
}

/** Logs a chase-up on a contact, which also takes it off the waiting list. */
export function useFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
    meta: { errorMessage: "Couldn't log the follow-up." },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/api/contacts?id=${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
    meta: { errorMessage: "Couldn't delete the contact." },
  });
}
