import {
  formatDays,
  formatPerM2,
  formatPriceCompact,
  formatSignedPct,
} from "@/lib/format";
import type { SegmentSummary } from "@/lib/market-trends";
import { daysOnMarket, sameHouseChange } from "./market-math";
import { StatTile } from "./stat-tile";

export function MarketStats({ summary }: { summary: SegmentSummary }) {
  const change = sameHouseChange(summary);
  const days = daysOnMarket(summary);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Median asking price"
        value={formatPriceCompact(summary.medianPrice)}
        detail={formatPerM2(summary.medianPpm2)}
      />
      <StatTile
        label="Same houses, 8 weeks"
        value={change == null ? "—" : formatSignedPct(change)}
        detail={
          change == null
            ? "needs 8 weeks of history"
            : `average asking change, ${summary.sameHouseSample} houses`
        }
      />
      <StatTile
        label="Houses on the market"
        value={String(summary.activeHouses)}
        detail={`+${summary.newLast4w} new, −${summary.goneLast4w} gone adverts in 4 weeks`}
      />
      <StatTile
        label="Time on the market"
        value={days == null ? "—" : formatDays(days.median)}
        detail={
          days == null
            ? "not enough houses have gone yet"
            : `median; fastest quarter ${formatDays(days.fast)}`
        }
      />
    </div>
  );
}
