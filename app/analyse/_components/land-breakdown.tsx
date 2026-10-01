import type { HouseAnalysis } from "@/lib/analysis-types";
import { formatArea, formatPerM2, formatPrice } from "@/lib/format";

/** Splits the asking price into the plot at local land prices and the house. */
export function LandBreakdown({ report }: { report: HouseAnalysis }) {
  const { listing, landPrice, landSplit, valuation } = report;
  if (!landPrice || !landSplit) {
    return (
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {listing.landAreaM2
          ? "Not enough building plots for sale nearby to price the land, so houses are compared on asking price per m²."
          : "The plot size is missing, so the land can't be priced and houses are compared on asking price per m²."}
      </p>
    );
  }
  const isBelowLand = landSplit.houseValue <= 0;
  const source = `${landPrice.sample} building plots of a similar size for sale within ${landPrice.radiusKm} km`;
  const rows = [
    [
      `Plot ${formatArea(listing.landAreaM2)} × ${formatPerM2(landPrice.ppm2)}`,
      formatPrice(landSplit.landValue),
    ],
    ["House alone", isBelowLand ? "—" : formatPrice(landSplit.houseValue)],
    ["House alone per usable m²", formatPerM2(landSplit.housePpm2)],
  ];
  return (
    <div className="mt-4 rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">
        Land vs house
        {valuation?.basis === "building" && " · the basis of the comparison"}
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {isBelowLand
          ? `The asking price is below the estimated land value (median of ${source}): you'd be paying about land price for the plot.`
          : `Land price is the median of ${source}.`}
      </p>
    </div>
  );
}
