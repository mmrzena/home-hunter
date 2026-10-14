"use client";

import {
  type RemixiconComponentType,
  RiAlarmWarningLine,
  RiBarChartBoxLine,
  RiCalendarEventLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiHistoryLine,
  RiHome4Line,
  RiMailLine,
  RiMore2Line,
  RiNavigationLine,
  RiPencilLine,
  RiPhoneLine,
  RiSendPlaneLine,
  RiStarLine,
  RiUser3Line,
} from "@remixicon/react";
import Link from "next/link";
import { useState } from "react";

import {
  ContactDialog,
  type ContactDialogFocus,
} from "@/components/contacts/contact-dialog";
import { FollowUpDialog } from "@/components/contacts/follow-up-dialog";
import { RatingStars } from "@/components/contacts/rating-stars";
import {
  useDeleteContact,
  useSaveContact,
} from "@/components/contacts/use-contacts";
import { GalleryPhoto } from "@/components/gallery-photo";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { STATUS_DOT } from "@/lib/contact-status-style";
import {
  CONTACT_STATUS_LABEL,
  CONTACT_STATUSES,
  type Contact,
  type ContactEvent,
  currentPriceChange,
  daysSinceActivity,
  detailsOf,
  EVENT_LABEL,
  houseOf,
  isContactStatus,
  isRating,
  isUpcomingVisit,
  isVisitOverdue,
  navigateHref,
  needsChaseUp,
  needsVerdict,
  RATING_LABEL,
  telHref,
  verdictStatus,
} from "@/lib/contacts";
import {
  formatArea,
  formatDayMonth,
  formatDistance,
  formatPrice,
  formatSource,
  formatVisit,
} from "@/lib/format";
import {
  DEAL_VERDICT_LABEL,
  percentileTone,
  TONE_BADGE,
} from "@/lib/listing-status";
import { largePhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { visitIcsHref } from "@/lib/visit-ics";

function advertState(contact: Contact): string | null {
  if (!contact.current) return null;
  if (!contact.current.isActive) return "Advert removed";
  const priceNow = currentPriceChange(contact);
  return priceNow == null ? null : `Now ${formatPrice(priceNow)}`;
}

/** "12th pct · fair price" from the pipeline's current view of the advert. */
function marketLine(contact: Contact): { text: string; tone: string } | null {
  const current = contact.current;
  if (!current || current.percentile == null) return null;
  const verdict = DEAL_VERDICT_LABEL[current.dealVerdict ?? "fair"];
  return {
    text: `${Math.round(current.percentile)}th pct · ${verdict.toLowerCase()}`,
    tone: TONE_BADGE[percentileTone(current.percentile)],
  };
}

/** A history event's stored raw value, as the user reads it. */
function eventDetail(event: ContactEvent): string | null {
  if (event.detail === null) return null;
  switch (event.kind) {
    case "status":
      return isContactStatus(event.detail)
        ? CONTACT_STATUS_LABEL[event.detail]
        : event.detail;
    case "visit":
      return event.detail === "" ? "Cancelled" : formatVisit(event.detail);
    case "rating": {
      const rating = Number(event.detail);
      return isRating(rating) ? RATING_LABEL[rating] : "Cleared";
    }
    default:
      return event.detail;
  }
}

/**
 * What this dialog opens on: a slice of the notes, with the status the save
 * will move the house to (undefined keeps the current one).
 */
type Editing = { focus: ContactDialogFocus; status?: ContactStatus };

type Stage = Editing & { label: string; Icon: RemixiconComponentType };

const VERDICT_STAGE = { Icon: RiStarLine, focus: "verdict" } as const;
const VISIT_STAGE = { Icon: RiCalendarEventLine, focus: "visit" } as const;

/** The one thing to do next with this house, by where it is in the pipeline. */
function stageOf(contact: Contact, isOverdue: boolean): Stage | null {
  switch (contact.status) {
    case "contacted":
      return { ...VISIT_STAGE, label: "Plan visit", status: "visit_planned" };
    case "visit_planned":
      return isOverdue
        ? {
            ...VERDICT_STAGE,
            label: "How did it go?",
            status: verdictStatus(contact),
          }
        : { ...VISIT_STAGE, label: "Reschedule" };
    case "visited":
    case "offer":
      return {
        ...VERDICT_STAGE,
        label: contact.rating == null ? "Add verdict" : "Edit verdict",
      };
    case "rejected":
      return null;
  }
}

/** "Followed up" or "Status: Visit planned" — one history line. */
function eventLine(event: ContactEvent): string {
  const detail = eventDetail(event);
  return detail
    ? `${EVENT_LABEL[event.kind]}: ${detail}`
    : EVENT_LABEL[event.kind];
}

export function ContactCard({
  contact,
  now,
  isFocused = false,
}: {
  contact: Contact;
  now: number;
  /** Scrolls the card into view when it mounts (a map marker was clicked). */
  isFocused?: boolean;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [isLoggingFollowUp, setIsLoggingFollowUp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const save = useSaveContact();
  const remove = useDeleteContact();
  const current = contact.current;
  const state = advertState(contact);
  const market = marketLine(contact);
  const isRejected = contact.status === "rejected";
  const navigate = navigateHref(contact);
  const isChaseUp = needsChaseUp(contact, now);
  const isOverdue = isVisitOverdue(contact, now);
  const stage = stageOf(contact, isOverdue);
  // Newest first; the latest one is always on the card, the rest fold away.
  const [latestEvent, ...earlierEvents] = [...contact.events].reverse();
  const facts = [
    current?.usableAreaM2 != null &&
      `${formatArea(current.usableAreaM2)} usable`,
    current?.landAreaM2 != null && `${formatArea(current.landAreaM2)} plot`,
    current?.hub != null &&
      `${formatDistance(current.hub.km)} to ${current.hub.label}`,
  ].filter((fact): fact is string => typeof fact === "string");

  /**
   * Moving to "Visit planned" asks for the date and "Visited" for the verdict
   * (the save happens when that dialog is submitted); other statuses save at once.
   */
  function handleStatusChange(status: string) {
    if (!isContactStatus(status) || status === contact.status) return;
    if (status === "visit_planned") {
      setEditing({ focus: "visit", status });
      return;
    }
    if (status === "visited" && contact.rating == null) {
      setEditing({ focus: "verdict", status });
      return;
    }
    save.mutate({ ...detailsOf(contact), status, house: houseOf(contact) });
  }

  return (
    <article
      ref={(element) => {
        if (isFocused) element?.scrollIntoView({ block: "start" });
      }}
      className={cn(
        "flex scroll-mt-24 flex-col overflow-hidden rounded-xl border bg-card transition-opacity",
        isRejected && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="relative aspect-[16/9] bg-muted">
        {contact.photo ? (
          <GalleryPhoto
            src={largePhoto(contact.photo)}
            className="absolute inset-0 size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <RiHome4Line className="size-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {state && <Badge variant="secondary">{state}</Badge>}
          {market && <Badge className={market.tone}>{market.text}</Badge>}
        </div>
        {contact.rating != null && (
          <div className="absolute right-2 bottom-2 rounded-full bg-background/90 px-2 py-1 font-medium">
            <RatingStars rating={contact.rating} />
          </div>
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
            {facts.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {facts.join(" · ")}
              </p>
            )}
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
              {navigate && (
                <DropdownMenuItem asChild>
                  <a href={navigate} target="_blank" rel="noreferrer">
                    <RiNavigationLine /> Navigate there
                  </a>
                </DropdownMenuItem>
              )}
              {contact.visitAt && (
                <DropdownMenuItem asChild>
                  <a
                    href={visitIcsHref(contact)}
                    download={`visit-${contact.id}.ics`}
                  >
                    <RiCalendarLine /> Add visit to calendar
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setEditing({ focus: "all" })}>
                <RiPencilLine /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsLoggingFollowUp(true)}>
                <RiSendPlaneLine /> Log a follow-up
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

        {isChaseUp && (
          <div className="flex items-center gap-2 rounded-md bg-warning/15 py-1.5 pr-1.5 pl-2 text-xs text-warning-foreground">
            <RiAlarmWarningLine className="size-4 shrink-0" />
            <span className="flex-1">
              No activity for {daysSinceActivity(contact, now)} days. Chased
              them up?
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsLoggingFollowUp(true)}
            >
              Followed up
            </Button>
          </div>
        )}

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
              <dd>
                {formatVisit(contact.visitAt)}
                {isOverdue && " · no verdict yet"}
              </dd>
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

        {(contact.pros || contact.cons) && (
          <div className="grid gap-1 text-sm">
            {contact.pros && (
              <p className="line-clamp-2 text-green-700 dark:text-green-400">
                + {contact.pros}
              </p>
            )}
            {contact.cons && (
              <p className="line-clamp-2 text-red-700 dark:text-red-400">
                − {contact.cons}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setEditing({ focus: "all" })}
          title="Edit notes"
          className={cn(
            "text-left text-sm text-muted-foreground hover:text-foreground",
            contact.notes ? "line-clamp-3 whitespace-pre-line" : "w-fit",
          )}
        >
          {contact.notes || "+ Add contact details or notes"}
        </button>

        {latestEvent && (
          <Collapsible>
            <div className="flex items-center gap-2">
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <RiHistoryLine className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                  <span className="font-mono">
                    {formatDayMonth(latestEvent.createdAt)}
                  </span>{" "}
                  {eventLine(latestEvent)}
                </span>
                {earlierEvents.length > 0 && (
                  <span className="shrink-0">
                    +{earlierEvents.length} earlier
                  </span>
                )}
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0 text-muted-foreground"
                title="Add a follow-up to the history"
                onClick={() => setIsLoggingFollowUp(true)}
              >
                <RiSendPlaneLine /> Log
              </Button>
            </div>
            {earlierEvents.length > 0 && (
              <CollapsibleContent>
                <ol className="mt-2 space-y-1 border-l pl-3 text-xs text-muted-foreground">
                  {earlierEvents.map((event) => (
                    <li key={event.id} className="flex gap-2">
                      <span className="w-12 shrink-0 font-mono">
                        {formatDayMonth(event.createdAt)}
                      </span>
                      <span>{eventLine(event)}</span>
                    </li>
                  ))}
                </ol>
              </CollapsibleContent>
            )}
          </Collapsible>
        )}

        <div className="mt-auto flex gap-2 pt-1">
          {stage && (
            <Button
              variant={needsVerdict(contact, now) ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setEditing(stage)}
            >
              <stage.Icon className="size-4" /> {stage.label}
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("gap-1.5", !stage && "flex-1")}
          >
            <Link href={analyseHref(contact.url)}>
              <RiBarChartBoxLine className="size-4" /> Analysis
            </Link>
          </Button>
        </div>
      </div>

      {isLoggingFollowUp && (
        <FollowUpDialog
          contact={contact}
          onClose={() => setIsLoggingFollowUp(false)}
        />
      )}
      {editing && (
        <ContactDialog
          house={houseOf(contact)}
          initial={{
            ...detailsOf(contact),
            status: editing.status ?? contact.status,
          }}
          focus={editing.focus}
          onClose={() => setEditing(null)}
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
