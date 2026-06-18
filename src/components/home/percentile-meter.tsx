import { percentileTone, TONE_DOT, TONE_TEXT } from "@/lib/listing-status";
import { cn } from "@/lib/utils";

/**
 * The card's signature: where this listing's CZK/m² sits among comparable
 * houses in its area. Green (cheap) → grey → amber (pricey), with a marker at
 * the within-bucket percentile. The reading is tone-colored so a deal's number
 * looks like a deal; `left` is the one genuinely dynamic value, so it stays inline.
 */
export function PercentileMeter({
  percentile,
  confidence,
  sampleSize,
}: {
  percentile: number | null;
  confidence?: string | null;
  sampleSize?: number | null;
}) {
  if (percentile == null) {
    return (
      <p className="text-xs text-muted-foreground">No price benchmark yet</p>
    );
  }
  const pct = Math.round(percentile);
  const tone = percentileTone(percentile);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Price vs area</span>
        <span className={cn("font-mono font-semibold", TONE_TEXT[tone])}>
          {pct}
          <span className="text-[10px] font-normal">th pct</span>
          {confidence === "low" && (
            <span className="text-muted-foreground"> · est.</span>
          )}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-green-500/45 via-blueGrey-300/40 to-amber-500/55">
        {/* Median reference — read the marker against the market midpoint. */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/25" />
        <div
          className={cn(
            "absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
            TONE_DOT[tone],
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      {sampleSize != null && (
        <p className="text-[11px] text-muted-foreground">
          vs {sampleSize} comparable{sampleSize === 1 ? "" : "s"} nearby
        </p>
      )}
    </div>
  );
}
