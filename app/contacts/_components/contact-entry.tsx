"use client";

import {
  RiCalendarEventLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiMailLine,
  RiPencilLine,
  RiPhoneLine,
  RiUser3Line,
} from "@remixicon/react";
import { useState } from "react";

import { ContactDialog } from "@/components/contacts/contact-dialog";
import { useDeleteContact } from "@/components/contacts/use-contacts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONTACT_STATUS_LABEL, type Contact } from "@/lib/contacts";
import { formatPrice, formatSource } from "@/lib/format";

const VISIT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function advertState(contact: Contact): string | null {
  if (!contact.current) return null;
  if (!contact.current.isActive) return "Advert removed";
  const { price } = contact.current;
  if (price && contact.price && price !== contact.price)
    return `Now ${formatPrice(price)}`;
  return null;
}

export function ContactEntry({ contact }: { contact: Contact }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const remove = useDeleteContact();
  const isUpcoming =
    contact.visitAt && Date.parse(contact.visitAt) >= Date.now();
  const state = advertState(contact);

  return (
    <article className="flex gap-4 rounded-xl border p-4">
      {contact.photo && (
        // biome-ignore lint/performance/noImgElement: remote portal thumbnails, same as the feed cards
        <img
          src={contact.photo}
          alt=""
          className="hidden size-24 shrink-0 rounded-md object-cover sm:block"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={contact.status === "rejected" ? "outline" : "secondary"}
          >
            {CONTACT_STATUS_LABEL[contact.status]}
          </Badge>
          {state && <Badge variant="outline">{state}</Badge>}
          <span className="font-mono text-sm font-medium">
            {formatPrice(contact.price)}
          </span>
        </div>
        <a
          href={contact.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-1 font-medium hover:underline"
        >
          <span className="truncate">{contact.title ?? contact.url}</span>
          <RiExternalLinkLine className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatSource(contact.source)}
          </span>
        </a>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {contact.visitAt && (
            <div
              className={
                isUpcoming
                  ? "flex items-center gap-1.5 font-medium text-primary"
                  : "flex items-center gap-1.5"
              }
            >
              <dt className="sr-only">Visit</dt>
              <RiCalendarEventLine className="size-4" />
              <dd>{VISIT.format(new Date(contact.visitAt))}</dd>
            </div>
          )}
          {contact.contactName && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Contact person</dt>
              <RiUser3Line className="size-4" />
              <dd>{contact.contactName}</dd>
            </div>
          )}
          {contact.contactPhone && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Phone</dt>
              <RiPhoneLine className="size-4" />
              <dd>
                <a
                  href={`tel:${contact.contactPhone.replace(/\s/g, "")}`}
                  className="hover:text-foreground hover:underline"
                >
                  {contact.contactPhone}
                </a>
              </dd>
            </div>
          )}
          {contact.contactEmail && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Email</dt>
              <RiMailLine className="size-4" />
              <dd>
                <a
                  href={`mailto:${contact.contactEmail}`}
                  className="hover:text-foreground hover:underline"
                >
                  {contact.contactEmail}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {contact.notes && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {contact.notes}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Edit notes"
          onClick={() => setIsEditing(true)}
        >
          <RiPencilLine className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete"
          onClick={() => setIsConfirming(true)}
        >
          <RiDeleteBinLine className="size-4" />
        </Button>
      </div>
      {isEditing && (
        <ContactDialog
          house={{
            source: contact.source,
            sourceId: contact.sourceId,
            url: contact.url,
            title: contact.title,
            price: contact.price,
            photo: contact.photo,
            lat: contact.lat,
            lng: contact.lng,
          }}
          initial={contact}
          isOpen={isEditing}
          onOpenChange={setIsEditing}
        />
      )}
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              The house and all its notes (contact, phone, visit) are removed
              from your list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(contact.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
