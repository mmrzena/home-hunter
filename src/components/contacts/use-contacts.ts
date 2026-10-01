"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-client";
import {
  type Contact,
  type ContactSave,
  IS_DEV_WITHOUT_SIGN_IN,
} from "@/lib/contacts";

const CONTACTS_KEY = ["contacts"] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

/** The signed-in user's contacted houses, newest edit first. */
export function useContacts() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: () =>
      request<{ contacts: Contact[] }>("/api/contacts").then(
        (body) => body.contacts,
      ),
    enabled: Boolean(session?.user) || IS_DEV_WITHOUT_SIGN_IN,
    meta: { errorMessage: "Couldn't load your contacted houses." },
  });
}

export function useSaveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (save: ContactSave) =>
      request("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(save),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
    meta: { errorMessage: "Couldn't save the contact." },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request(`/api/contacts?id=${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
    meta: { errorMessage: "Couldn't delete the contact." },
  });
}
