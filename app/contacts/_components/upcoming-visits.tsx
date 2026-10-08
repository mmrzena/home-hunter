import { RiNavigationLine } from "@remixicon/react";
import Link from "next/link";

import { CallButton } from "@/components/contacts/call-button";
import { Button } from "@/components/ui/button";
import { analyseHref } from "@/lib/analyse-href";
import { type Contact, navigateHref } from "@/lib/contacts";
import { formatDayMonth } from "@/lib/format";
import { AgendaSection } from "./agenda-section";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "Europe/Prague",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

function relativeDay(date: Date, now: Date): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** The agenda: upcoming visits, soonest first, with directions and a one-tap call. */
export function UpcomingVisits({
  visits,
  now,
}: {
  visits: Contact[];
  now: number;
}) {
  return (
    <AgendaSection id="visits-heading" title="Next visits">
      {visits.map((visit) => {
        const date = new Date(visit.visitAt);
        const navigate = navigateHref(visit);
        return (
          <li key={visit.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1.5 text-primary">
              <span className="text-[11px] font-medium uppercase">
                {WEEKDAY.format(date)}
              </span>
              <span className="text-sm font-semibold">
                {formatDayMonth(visit.visitAt)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {relativeDay(date, new Date(now))} · {TIME.format(date)}
                {visit.contactName && ` · ${visit.contactName}`}
              </p>
              <Link
                href={analyseHref(visit.url)}
                className="block truncate text-sm font-medium hover:underline"
              >
                {visit.title ?? visit.url}
              </Link>
            </div>
            {navigate && (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Navigate there"
              >
                <a href={navigate} target="_blank" rel="noreferrer">
                  <RiNavigationLine className="size-4" />
                </a>
              </Button>
            )}
            {visit.contactPhone && <CallButton phone={visit.contactPhone} />}
          </li>
        );
      })}
    </AgendaSection>
  );
}
