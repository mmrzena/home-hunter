import { RiPhoneLine } from "@remixicon/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { analyseHref } from "@/lib/analyse-href";
import { type Contact, telHref } from "@/lib/contacts";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function relativeDay(date: Date, now: Date): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** The agenda: upcoming visits, soonest first, with a one-tap call. */
export function UpcomingVisits({
  visits,
  now,
}: {
  visits: Contact[];
  now: number;
}) {
  return (
    <section aria-labelledby="visits-heading" className="rounded-xl border">
      <h2
        id="visits-heading"
        className="border-b px-4 py-3 text-sm font-semibold"
      >
        Next visits
      </h2>
      <ol className="divide-y">
        {visits.map((visit) => {
          const date = new Date(visit.visitAt);
          return (
            <li key={visit.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1.5 text-primary">
                <span className="text-[11px] font-medium uppercase">
                  {WEEKDAY.format(date)}
                </span>
                <span className="text-sm font-semibold">
                  {DAY_MONTH.format(date)}
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
              {visit.contactPhone && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={telHref(visit.contactPhone)}>
                    <RiPhoneLine className="size-4" />
                    <span className="hidden sm:inline">
                      {visit.contactPhone}
                    </span>
                  </a>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
