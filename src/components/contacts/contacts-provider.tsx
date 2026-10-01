"use client";

import { createContext, useContext, useMemo } from "react";

import { useSession } from "@/lib/auth-client";
import {
  type Contact,
  contactKey,
  IS_DEV_WITHOUT_SIGN_IN,
} from "@/lib/contacts";
import { useContactsQuery } from "./use-contacts";

type ContactsState = {
  /** Sign-in is configured, or this is `next dev` (no sign-in needed). */
  isAvailable: boolean;
  isSessionPending: boolean;
  canUse: boolean;
  /** Undefined until loaded (or when the user can't use contacts). */
  contacts: Contact[] | undefined;
  isLoadingContacts: boolean;
  byKey: Map<string, Contact>;
};

const ContactsContext = createContext<ContactsState | null>(null);

/**
 * One contacts query and lookup for the whole app, so the feed's ~500 contact
 * buttons each do a Map lookup instead of their own query and scan.
 */
export function ContactsProvider({
  isAuthEnabled,
  children,
}: {
  isAuthEnabled: boolean;
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const canUse = Boolean(session?.user) || IS_DEV_WITHOUT_SIGN_IN;
  const { data: contacts, isPending: isQueryPending } =
    useContactsQuery(canUse);
  const isLoadingContacts = canUse && isQueryPending;
  // Memoized so consumers only re-render when the session or contacts change.
  const value = useMemo<ContactsState>(
    () => ({
      isAvailable: isAuthEnabled || IS_DEV_WITHOUT_SIGN_IN,
      isSessionPending: isPending,
      canUse,
      contacts,
      isLoadingContacts,
      byKey: new Map(
        (contacts ?? []).map((contact) => [contactKey(contact), contact]),
      ),
    }),
    [isAuthEnabled, isPending, canUse, contacts, isLoadingContacts],
  );
  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContactsState(): ContactsState {
  const state = useContext(ContactsContext);
  if (!state) throw new Error("useContactsState needs a ContactsProvider");
  return state;
}
