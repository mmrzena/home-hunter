"use client";

import Link from "next/link";

import { RatingStars } from "@/components/contacts/rating-stars";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyseHref } from "@/lib/analyse-href";
import { STATUS_DOT } from "@/lib/contact-status-style";
import {
  CONTACT_STATUS_LABEL,
  type Contact,
  currentPriceChange,
} from "@/lib/contacts";
import {
  formatArea,
  formatDayMonth,
  formatDistance,
  formatPriceCompact,
} from "@/lib/format";
import { percentileTone, TONE_TEXT } from "@/lib/listing-status";
import { cn } from "@/lib/utils";

/** Best verdict first, then cheapest; unrated houses sink to the bottom. */
function byVerdict(left: Contact, right: Contact): number {
  const byRating = (right.rating ?? 0) - (left.rating ?? 0);
  if (byRating !== 0) return byRating;
  return (left.price ?? Infinity) - (right.price ?? Infinity);
}

/** The houses side by side — what you actually weigh when choosing. */
export function CompareTable({ contacts }: { contacts: Contact[] }) {
  const rows = [...contacts].sort(byVerdict);
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">House</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Pct</TableHead>
            <TableHead className="text-right">Usable</TableHead>
            <TableHead className="text-right">Plot</TableHead>
            <TableHead className="text-right">Distance</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Visit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((contact) => {
            const current = contact.current;
            const priceNow = currentPriceChange(contact);
            return (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {contact.photo ? (
                      // biome-ignore lint/performance/noImgElement: remote portal thumbnail
                      <img
                        src={contact.photo}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="size-10 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={analyseHref(contact.url)}
                        className="line-clamp-1 font-medium hover:underline"
                      >
                        {contact.title ?? contact.url}
                      </Link>
                      {(contact.pros || contact.cons) && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {contact.pros && `+ ${contact.pros}`}
                          {contact.pros && contact.cons && " · "}
                          {contact.cons && `− ${contact.cons}`}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPriceCompact(contact.price)}
                  {priceNow != null && (
                    <span className="block text-xs text-muted-foreground">
                      now {formatPriceCompact(priceNow)}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    current?.percentile != null &&
                      TONE_TEXT[percentileTone(current.percentile)],
                  )}
                >
                  {current?.percentile != null
                    ? `${Math.round(current.percentile)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatArea(current?.usableAreaM2)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatArea(current?.landAreaM2)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {current?.hub != null ? (
                    <span title={`to ${current.hub.label}`}>
                      {formatDistance(current.hub.km)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {contact.rating != null ? (
                    <RatingStars rating={contact.rating} isCompact />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        STATUS_DOT[contact.status],
                      )}
                    />
                    {CONTACT_STATUS_LABEL[contact.status]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono">
                  {contact.visitAt ? formatDayMonth(contact.visitAt) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
