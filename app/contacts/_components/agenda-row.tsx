import Link from "next/link";
import type { ReactNode } from "react";

import { analyseHref } from "@/lib/analyse-href";
import type { Contact } from "@/lib/contacts";

/** One house in an agenda list: a meta line, the title, then its actions. */
export function AgendaRow({
  contact,
  meta,
  leading,
  children,
}: {
  contact: Contact;
  /** "Tomorrow · 10:00"; the contact person is appended when known. */
  meta: ReactNode;
  /** A tile before the text (the visit's date). */
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {leading}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {meta}
          {contact.contactName && ` · ${contact.contactName}`}
        </p>
        <Link
          href={analyseHref(contact.url)}
          className="block truncate text-sm font-medium hover:underline"
        >
          {contact.title ?? contact.url}
        </Link>
      </div>
      {children}
    </li>
  );
}
