"use client";

import { RiAlarmWarningLine, RiCheckLine } from "@remixicon/react";
import Link from "next/link";

import { CallButton } from "@/components/contacts/call-button";
import { useFollowUp } from "@/components/contacts/use-contacts";
import { Button } from "@/components/ui/button";
import { analyseHref } from "@/lib/analyse-href";
import { type Contact, daysSinceActivity } from "@/lib/contacts";
import { AgendaSection } from "./agenda-section";

/** Contacted houses that went quiet — the ones to nudge. */
export function ChaseUpList({
  contacts,
  now,
}: {
  contacts: Contact[];
  now: number;
}) {
  const followUp = useFollowUp();

  return (
    <AgendaSection
      id="chase-heading"
      title={
        <>
          <RiAlarmWarningLine className="size-4 text-warning-foreground" />
          Waiting for a reply
        </>
      }
    >
      {contacts.map((contact) => {
        const isPending =
          followUp.isPending && followUp.variables === contact.id;
        return (
          <li key={contact.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {daysSinceActivity(contact, now)} days without activity
                {contact.contactName && ` · ${contact.contactName}`}
              </p>
              <Link
                href={analyseHref(contact.url)}
                className="block truncate text-sm font-medium hover:underline"
              >
                {contact.title ?? contact.url}
              </Link>
            </div>
            {contact.contactPhone && (
              <CallButton phone={contact.contactPhone} />
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isPending}
              title="Log that you chased them up today"
              onClick={() => followUp.mutate(contact.id)}
            >
              <RiCheckLine className="size-4" />
              <span className="hidden sm:inline">Followed up</span>
              <span className="sr-only sm:hidden">Followed up</span>
            </Button>
          </li>
        );
      })}
    </AgendaSection>
  );
}
