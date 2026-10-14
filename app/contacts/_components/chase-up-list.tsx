"use client";

import { RiAlarmWarningLine } from "@remixicon/react";

import { CallButton } from "@/components/contacts/call-button";
import { FollowUpButton } from "@/components/contacts/follow-up-button";
import { type Contact, daysSinceActivity } from "@/lib/contacts";
import { AgendaRow } from "./agenda-row";
import { AgendaSection } from "./agenda-section";

/** Contacted houses that went quiet — the ones to nudge. */
export function ChaseUpList({
  contacts,
  now,
}: {
  contacts: Contact[];
  now: number;
}) {
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
      {contacts.map((contact) => (
        <AgendaRow
          key={contact.id}
          contact={contact}
          meta={`${daysSinceActivity(contact, now)} days without activity`}
        >
          {contact.contactPhone && <CallButton phone={contact.contactPhone} />}
          <FollowUpButton contact={contact} size="sm" />
        </AgendaRow>
      ))}
    </AgendaSection>
  );
}
