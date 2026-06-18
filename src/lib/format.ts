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
