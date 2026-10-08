const czk = new Intl.NumberFormat("cs-CZ");

/** Full price with thousands separators, e.g. "6 990 000 Kč". */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || value <= 0) return "cena na dotaz";
  return `${czk.format(Math.round(value))} Kč`;
}

/** Compact price for tight spots, e.g. "6,99 mil. Kč". */
export function formatPriceCompact(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  const millions = value / 1_000_000;
  return `${millions.toFixed(millions >= 10 ? 0 : 2).replace(".", ",")} mil. Kč`;
}

export function formatPerM2(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  return `${czk.format(Math.round(value))} Kč/m²`;
}

export function formatArea(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${czk.format(value)} m²`;
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "—";
  return km < 10
    ? `${km.toFixed(1).replace(".", ",")} km`
    : `${Math.round(km)} km`;
}

/** Population, compacted for big places: "850", "12k", "1.4M". */
export function formatPopulation(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return czk.format(value);
}

export function formatKind(kind: string | null | undefined): string {
  if (kind === "vila") return "Vila";
  if (kind === "rodinny_dum") return "Rodinný dům";
  return "Dům";
}

const SOURCE_LABELS: Record<string, string> = {
  sreality: "Sreality",
  bezrealitky: "Bezrealitky",
  ceskereality: "České reality",
  realingo: "Realingo",
};

/** Source key → portal display name (falls back to the raw key). */
export function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Journey length: "46 min", "2 h 21 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Changes on a journey: "direct", "1 change", "2 changes". */
export function formatTransfers(transfers: number): string {
  if (transfers === 0) return "direct";
  return transfers === 1 ? "1 change" : `${transfers} changes`;
}

// Pinned to Prague time so server-rendered dates match the client exactly
// (a UTC server and a local browser would otherwise disagree around midnight).
const TIME_ZONE = "Europe/Prague";
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const yearOf = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  timeZone: TIME_ZONE,
});

const visitDateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "8 Oct" in Prague time. */
export function formatDayMonth(iso: string): string {
  return dayMonth.format(new Date(iso));
}

/** "Fri 9 Oct, 10:00" in Prague time — a visit slot. */
export function formatVisit(iso: string): string {
  return visitDateTime.format(new Date(iso));
}

/** "8 Oct" within the current year, "8 Oct 2025" otherwise. */
export function formatDateAdded(iso: string): string {
  const date = new Date(iso);
  return yearOf.format(date) === yearOf.format(new Date())
    ? dayMonth.format(date)
    : dayMonthYear.format(date);
}

/** "8 Oct 2026, 14:05" in Prague time. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
