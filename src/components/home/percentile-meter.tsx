import { percentileTone, TONE_DOT } from "@/lib/listing-status";
import { cn } from "@/lib/utils";

/**
 * A price-percentile bar: green (cheap) → grey → amber (expensive), with a
 * marker at the listing's within-bucket percentile. The marker's `left` is the
 * one genuinely dynamic value, so it stays inline.
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
      <p className="text-xs text-muted-foreground">
        No price benchmark for this listing
      </p>
    );
  }
  const pct = Math.round(percentile);
  const tone = percentileTone(percentile);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">CZK/m² vs area</span>
        <span className="font-medium">
          {pct}th pct{confidence === "low" && " · low conf"}
        </span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-gradient-to-r from-green-500/40 via-blueGrey-300/50 to-amber-500/50">
        <div
          className={cn(
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
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
