import type { Contact } from "@/lib/contacts";

const VISIT_MINUTES = 60;

function icsStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/[,;]/g, "\\$&");
}

/** A one-event iCalendar file for a planned visit, as a data: URL to download. */
export function visitIcsHref(contact: Contact): string {
  const start = new Date(contact.visitAt);
  const end = new Date(start.getTime() + VISIT_MINUTES * 60_000);
  const description = [
    contact.contactName && `Contact: ${contact.contactName}`,
    contact.contactPhone && `Phone: ${contact.contactPhone}`,
    contact.url,
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//home-hunter//visit//EN",
    "BEGIN:VEVENT",
    `UID:home-hunter-contact-${contact.id}@local`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(`House visit: ${contact.title ?? contact.url}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    contact.lat != null && contact.lng != null
      ? `GEO:${contact.lat};${contact.lng}`
      : null,
    `URL:${contact.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
