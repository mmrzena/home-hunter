import { RiInformationLine } from "@remixicon/react";
import type { HouseAnalysis } from "@/lib/analysis-types";
import { formatPerM2, formatPrice, formatPriceCompact } from "@/lib/format";

export function PriceAnalysis({ report }: { report: HouseAnalysis }) {
  const { listing, valuation } = report;
  const area = listing.usableAreaM2 ?? 0;
  const ppm2 = listing.price && area > 0 ? listing.price / area : null;
  const difference =
    valuation && ppm2 ? (ppm2 / valuation.medianPpm2 - 1) * 100 : null;
  return (
    <section
      className="flex flex-col rounded-2xl border bg-card p-6 sm:p-8"
      aria-labelledby="price-heading"
    >
      <p
        id="price-heading"
        className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        The asking price
      </p>
      <p className="mt-3 font-mono text-3xl font-medium tracking-tight sm:text-4xl">
        {formatPrice(listing.price)}
      </p>
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        {formatPerM2(ppm2)}{" "}
        <span className="font-sans">of usable floor area</span>
      </p>
      {valuation ? (
        <>
          <div className="mt-7 border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {valuation.verdict === "deal"
                  ? "At the lower end of the market"
                  : valuation.verdict === "overpriced"
                    ? "At the higher end of the market"
                    : "Within the typical asking range"}
              </h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {valuation.confidence === "high" ? "Stronger" : "Limited"}{" "}
                evidence
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {difference != null && (
                <>
                  <span className="font-medium text-foreground">
                    {Math.abs(difference).toFixed(0)}%{" "}
                    {difference < 0 ? "below" : "above"}
                  </span>{" "}
                  the median price per m² of {valuation.sampleSize} comparable
                  houses.
                </>
              )}
            </p>
            <div
              className="relative mt-7 h-2 rounded-full bg-gradient-to-r from-primary/30 via-primary to-amber-500/60"
              role="img"
              aria-label={`Price percentile: ${Math.round(valuation.percentile)} out of 100`}
            >
              <span
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-foreground shadow-sm"
                style={{
                  left: `${Math.max(2, Math.min(98, valuation.percentile))}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Lower asking prices</span>
              <span>Higher asking prices</span>
            </div>
          </div>
          <div className="mt-7 rounded-xl bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">
              Middle 50% of comparisons, scaled to {area} m²
            </p>
            <p className="mt-2 font-mono text-lg font-medium">
              {formatPriceCompact(valuation.lowerPpm2 * area)} –{" "}
              {formatPriceCompact(valuation.upperPpm2 * area)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Median benchmark: {formatPrice(valuation.medianPpm2 * area)}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-7 rounded-xl bg-muted/60 p-5">
          <h2 className="font-semibold">No reliable price comparison yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            An asking price, usable area and at least 8 recent, comparable
            houses in the local market are needed.
          </p>
        </div>
      )}
      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <RiInformationLine className="mt-0.5 size-4 shrink-0" />
        Based on advertised prices, not completed sales. Condition, renovations,
        energy performance and legal status are not priced into this benchmark.
      </p>
    </section>
  );
}
