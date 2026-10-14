"use client";

import { RiStarLine } from "@remixicon/react";
import { useState } from "react";

import { ContactDialog } from "@/components/contacts/contact-dialog";
import { Button } from "@/components/ui/button";
import {
  type Contact,
  detailsOf,
  houseOf,
  verdictStatus,
} from "@/lib/contacts";
import { formatVisit } from "@/lib/format";
import { AgendaRow } from "./agenda-row";
import { AgendaSection } from "./agenda-section";

/** Visits that happened (or whose date passed) with no verdict yet. */
export function VerdictList({ contacts }: { contacts: Contact[] }) {
  const [editing, setEditing] = useState<Contact | null>(null);

  return (
    <>
      <AgendaSection
        id="verdict-heading"
        title={
          <>
            <RiStarLine className="size-4 text-primary" />
            How did it go?
          </>
        }
      >
        {contacts.map((contact) => (
          <AgendaRow
            key={contact.id}
            contact={contact}
            meta={
              contact.visitAt
                ? `Visit ${formatVisit(contact.visitAt)}`
                : "Visited"
            }
          >
            <Button size="sm" onClick={() => setEditing(contact)}>
              Record verdict
            </Button>
          </AgendaRow>
        ))}
      </AgendaSection>
      {editing && (
        <ContactDialog
          house={houseOf(editing)}
          initial={{ ...detailsOf(editing), status: verdictStatus(editing) }}
          focus="verdict"
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
