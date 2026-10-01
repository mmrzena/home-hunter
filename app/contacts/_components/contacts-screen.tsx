"use client";

import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useContactsState } from "@/components/contacts/contacts-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ContactStatus } from "@/db/schema";
import { useSession } from "@/lib/auth-client";
import {
  CONTACT_STATUS_LABEL,
  CONTACT_STATUSES,
  type Contact,
  IS_DEV_WITHOUT_SIGN_IN,
  isContactStatus,
  isUpcomingVisit,
  STATUS_ORDER,
} from "@/lib/contacts";
import { ContactCard } from "./contact-card";
import { NoContactsEmpty } from "./no-contacts-empty";
import { SignInEmpty } from "./sign-in-empty";
import { UpcomingVisits } from "./upcoming-visits";

type View = "all" | ContactStatus;

/**
 * Pipeline order. Planned visits go soonest first, with not-yet-dated ones
 * after them; everything else by last edit.
 */
function byPipeline(left: Contact, right: Contact): number {
  const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
  if (byStatus !== 0) return byStatus;
  if (left.status === "visit_planned") {
    const leftVisit = left.visitAt ? Date.parse(left.visitAt) : Infinity;
    const rightVisit = right.visitAt ? Date.parse(right.visitAt) : Infinity;
    if (leftVisit !== rightVisit) return leftVisit - rightVisit;
  }
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

export function ContactsScreen({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  const { data: session } = useSession();
  const { isAvailable, isSessionPending, canUse, contacts, isLoadingContacts } =
    useContactsState();
  const [view, setView] = useState<View>("all");
  // One "now" per mount keeps upcoming/past stable across re-renders.
  const [now] = useState(Date.now);

  const all = [...(contacts ?? [])].sort(byPipeline);
  const counts = new Map<ContactStatus, number>();
  for (const contact of all)
    counts.set(contact.status, (counts.get(contact.status) ?? 0) + 1);
  const upcoming = all
    .filter((contact) => isUpcomingVisit(contact, now))
    .sort(
      (left, right) => Date.parse(left.visitAt) - Date.parse(right.visitAt),
    );
  // A status tab that just emptied (its last house moved on) falls back to All.
  const effectiveView = view !== "all" && !counts.get(view) ? "all" : view;
  const shown =
    effectiveView === "all"
      ? all
      : all.filter((contact) => contact.status === effectiveView);

  function renderBody() {
    if (!isAvailable)
      return (
        <p className="text-sm text-muted-foreground">
          Contact notes need sign-in, which isn't configured on this
          installation.
        </p>
      );
    if (isSessionPending || isLoadingContacts)
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={`skeleton-${index}`} className="h-96 rounded-xl" />
          ))}
        </div>
      );
    if (!canUse) return <SignInEmpty />;
    if (all.length === 0) return <NoContactsEmpty />;
    return (
      <div className="space-y-6">
        {upcoming.length > 0 && <UpcomingVisits visits={upcoming} now={now} />}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={effectiveView}
          onValueChange={(next) => {
            if (next === "all" || isContactStatus(next)) setView(next);
          }}
          className="flex-wrap"
        >
          <ToggleGroupItem value="all" className="h-8 text-xs">
            All {all.length}
          </ToggleGroupItem>
          {CONTACT_STATUSES.filter((status) => counts.get(status)).map(
            (status) => (
              <ToggleGroupItem
                key={status}
                value={status}
                className="h-8 text-xs"
              >
                {CONTACT_STATUS_LABEL[status]} {counts.get(status)}
              </ToggleGroupItem>
            ),
          )}
        </ToggleGroup>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((contact) => (
            <ContactCard key={contact.id} contact={contact} now={now} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="contacts" isAuthEnabled={isAuthEnabled} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Contacted houses
          </h1>
          {IS_DEV_WITHOUT_SIGN_IN && !session?.user && (
            <p className="mt-2 w-fit rounded-md bg-warning/20 px-2 py-1 text-xs text-warning-foreground">
              Local dev mode: saved without sign-in under a local user. The
              deployed app requires sign-in.
            </p>
          )}
        </div>
        {renderBody()}
      </main>
    </div>
  );
}
