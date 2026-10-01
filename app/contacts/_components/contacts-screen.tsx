"use client";

import { RiGoogleFill } from "@remixicon/react";
import { AppHeader } from "@/components/app-header";
import { useContacts } from "@/components/contacts/use-contacts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signIn, useSession } from "@/lib/auth-client";
import { type Contact, IS_DEV_WITHOUT_SIGN_IN } from "@/lib/contacts";
import { ContactEntry } from "./contact-entry";

/** Upcoming visits first (soonest first), then everything else by last edit. */
function byNextStep(contacts: Contact[]): Contact[] {
  const now = Date.now();
  const upcoming = contacts
    .filter((contact) => contact.visitAt && Date.parse(contact.visitAt) >= now)
    .sort(
      (left, right) => Date.parse(left.visitAt) - Date.parse(right.visitAt),
    );
  const rest = contacts.filter((contact) => !upcoming.includes(contact));
  return [...upcoming, ...rest];
}

export function ContactsScreen({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  const { data: session, isPending } = useSession();
  const contacts = useContacts();
  const list = byNextStep(contacts.data ?? []);
  const canUse = Boolean(session?.user) || IS_DEV_WITHOUT_SIGN_IN;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="contacts" isAuthEnabled={isAuthEnabled} />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Contacted houses
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mark a house from the feed or the analysis page with the contacts
          button to keep it here, with the contact person, phone, visit date and
          your notes.
        </p>
        {IS_DEV_WITHOUT_SIGN_IN && !session?.user && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Local dev mode: saved without sign-in under a local user. The
            deployed app requires sign-in.
          </p>
        )}

        <div className="mt-8 space-y-4">
          {!isAuthEnabled && !IS_DEV_WITHOUT_SIGN_IN ? (
            <p className="text-sm text-muted-foreground">
              Contact notes need sign-in, which isn't configured on this
              installation.
            </p>
          ) : isPending || (canUse && contacts.isPending) ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : !canUse ? (
            <div className="rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">
                Your notes include phone numbers, so they're stored privately on
                your account.
              </p>
              <Button
                className="mt-4 gap-1.5"
                onClick={() =>
                  signIn.social({
                    provider: "google",
                    callbackURL: "/contacts",
                  })
                }
              >
                <RiGoogleFill className="size-4" /> Sign in
              </Button>
            </div>
          ) : list.length === 0 ? (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              No contacted houses yet.
            </p>
          ) : (
            list.map((contact) => (
              <ContactEntry key={contact.id} contact={contact} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
