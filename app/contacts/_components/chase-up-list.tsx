import { RiAlarmWarningLine } from "@remixicon/react";
import Link from "next/link";

import { CallButton } from "@/components/contacts/call-button";
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
        <li key={contact.id} className="flex items-center gap-4 px-4 py-3">
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
          {contact.contactPhone && <CallButton phone={contact.contactPhone} />}
        </li>
      ))}
    </AgendaSection>
  );
}
