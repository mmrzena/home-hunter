"use client";

import {
  RiBarChartBoxLine,
  RiCalendarEventLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiHome4Line,
  RiMailLine,
  RiMore2Line,
  RiPencilLine,
  RiPhoneLine,
  RiUser3Line,
} from "@remixicon/react";
import Link from "next/link";
import { useState } from "react";

import { ContactDialog } from "@/components/contacts/contact-dialog";
import {
  useDeleteContact,
  useSaveContact,
} from "@/components/contacts/use-contacts";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactStatus } from "@/db/schema";
import { analyseHref } from "@/lib/analyse-href";
import {
  CONTACT_STATUS_LABEL,
  CONTACT_STATUSES,
  type Contact,
  detailsOf,
  houseOf,
  isContactStatus,
  isUpcomingVisit,
  telHref,
} from "@/lib/contacts";
import { formatPrice, formatSource } from "@/lib/format";
import { largePhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<ContactStatus, string> = {
  contacted: "bg-muted-foreground",
  visit_planned: "bg-primary",
  visited: "bg-blueGrey-500",
  offer: "bg-success",
  rejected: "bg-destructive/60",
};

const VISIT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
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

export function ContactCard({
  contact,
  now,
}: {
  contact: Contact;
  now: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const save = useSaveContact();
  const remove = useDeleteContact();
  const state = advertState(contact);
  const isRejected = contact.status === "rejected";

  function handleStatusChange(status: string) {
    if (isContactStatus(status))
      save.mutate({ ...detailsOf(contact), status, house: houseOf(contact) });
  }

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card transition-opacity",
        isRejected && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="relative aspect-[16/9] bg-muted">
        {contact.photo ? (
          // biome-ignore lint/performance/noImgElement: remote portal photos, as on feed cards
          <img
            src={largePhoto(contact.photo)}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <RiHome4Line className="size-8" />
          </div>
        )}
        {state && (
          <Badge className="absolute top-2 left-2" variant="secondary">
            {state}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-lg font-semibold tracking-tight">
              {formatPrice(contact.price)}
            </p>
            <Link
              href={analyseHref(contact.url)}
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {contact.title ?? contact.url}
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 size-8 shrink-0"
                aria-label="More actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={contact.url} target="_blank" rel="noreferrer">
                  <RiExternalLinkLine /> Open on {formatSource(contact.source)}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                <RiPencilLine /> Edit notes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setIsConfirming(true)}
              >
                <RiDeleteBinLine /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Select value={contact.status} onValueChange={handleStatusChange}>
          <SelectTrigger size="sm" className="w-full" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <span
                  className={cn("size-2 rounded-full", STATUS_DOT[status])}
                />
                {CONTACT_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <dl className="space-y-1.5 text-sm">
          {contact.visitAt && (
            <div
              className={cn(
                "flex items-center gap-2",
                isUpcomingVisit(contact, now)
                  ? "font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              <dt className="sr-only">Visit</dt>
              <RiCalendarEventLine className="size-4 shrink-0" />
              <dd>{VISIT.format(new Date(contact.visitAt))}</dd>
            </div>
          )}
          {contact.contactName && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Contact person</dt>
              <RiUser3Line className="size-4 shrink-0 text-muted-foreground" />
              <dd className="truncate">{contact.contactName}</dd>
            </div>
          )}
          {contact.contactPhone && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Phone</dt>
              <RiPhoneLine className="size-4 shrink-0 text-muted-foreground" />
              <dd>
                <a
                  href={telHref(contact.contactPhone)}
                  className="text-primary hover:underline"
                >
                  {contact.contactPhone}
                </a>
              </dd>
            </div>
          )}
          {contact.contactEmail && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Email</dt>
              <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
              <dd className="truncate">
                <a
                  href={`mailto:${contact.contactEmail}`}
                  className="text-primary hover:underline"
                >
                  {contact.contactEmail}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title="Edit notes"
          className={cn(
            "text-left text-sm text-muted-foreground hover:text-foreground",
            contact.notes ? "line-clamp-3 whitespace-pre-line" : "w-fit",
          )}
        >
          {contact.notes || "+ Add contact details or notes"}
        </button>

        <div className="mt-auto flex gap-2 pt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
          >
            <Link href={analyseHref(contact.url)}>
              <RiBarChartBoxLine className="size-4" /> Analysis
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setIsEditing(true)}
          >
            <RiPencilLine className="size-4" /> Notes
          </Button>
        </div>
      </div>

      {isEditing && (
        <ContactDialog
          house={houseOf(contact)}
          initial={detailsOf(contact)}
          onClose={() => setIsEditing(false)}
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
