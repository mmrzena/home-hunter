import {
  RiLineChartLine,
  RiPriceTag3Line,
  RiScales3Line,
  RiTimerFlashLine,
} from "@remixicon/react";
import type { ComponentType } from "react";
import {
  formatDays,
  formatDecimal,
  formatPct,
  formatSignedPct,
} from "@/lib/format";
import type { SegmentSummary } from "@/lib/market-trends";
import {
  cutShare,
  daysOnMarket,
  MIN_SAME_HOUSE_SAMPLE,
  monthsOfSupply,
  sameHouseChange,
} from "./market-math";

type Cue = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const FLAT_CHANGE = 0.01;
const BUYERS_MARKET_MONTHS = 6;
const TIGHT_MARKET_MONTHS = 3;

const PRICE_DIRECTION = {
  down: {
    title: "Asking prices are slipping",
    advice:
      "Sellers are adjusting down, so there is no rush to pay full asking.",
  },
  up: {
    title: "Asking prices are rising",
    advice:
      "Waiting is costing money; a fair-priced house now beats a cheaper one later.",
  },
  flat: {
    title: "Asking prices are flat",
    advice: "Timing the market won't save much; pick on the house.",
  },
};

const MARKET_BALANCE = {
  buyers: {
    title: "A buyer's market",
    advice:
      "You have choice and time, and sellers need you more than you need them.",
  },
  tight: {
    title: "A tight market",
    advice: "Good houses won't wait; expect little room on price.",
  },
  balanced: {
    title: "A balanced market",
    advice: "Neither side has the upper hand.",
  },
};

function priceCue(summary: SegmentSummary): Cue {
  const change = sameHouseChange(summary);
  if (change == null)
    return {
      icon: RiLineChartLine,
      title: "Price direction: too early to call",
      body: `Fewer than ${MIN_SAME_HOUSE_SAMPLE} houses have been on the market for 8 weeks yet. This firms up as history builds.`,
    };
  let direction: keyof typeof PRICE_DIRECTION = "flat";
  if (change <= -FLAT_CHANGE) direction = "down";
  else if (change >= FLAT_CHANGE) direction = "up";
  const { title, advice } = PRICE_DIRECTION[direction];
  return {
    icon: RiLineChartLine,
    title,
    body: `The same ${summary.sameHouseSample} houses changed ${formatSignedPct(change)} on average over the last 8 weeks. ${advice}`,
  };
}

function balanceCue(summary: SegmentSummary): Cue | null {
  const months = monthsOfSupply(summary);
  if (months == null) return null;
  let balance: keyof typeof MARKET_BALANCE = "balanced";
  if (months >= BUYERS_MARKET_MONTHS) balance = "buyers";
  else if (months <= TIGHT_MARKET_MONTHS) balance = "tight";
  const { title, advice } = MARKET_BALANCE[balance];
  return {
    icon: RiScales3Line,
    title,
    body: `About ${formatDecimal(months, 1)} months of stock at the current pace. ${advice}`,
  };
}

function speedCue(summary: SegmentSummary): Cue | null {
  const days = daysOnMarket(summary);
  if (days == null) return null;
  return {
    icon: RiTimerFlashLine,
    title: "How long houses last",
    body: `A quarter of the houses that went were gone within ${formatDays(days.fast)}, half within ${formatDays(days.median)}. If one fits, book a viewing that week.`,
  };
}

function negotiationCue(summary: SegmentSummary): Cue | null {
  const share = cutShare(summary);
  if (share == null) return null;
  let body = `${formatPct(share * 100)} of houses on the market have cut their asking price`;
  if (summary.medianTotalCutPct != null)
    body += `, typically by ${formatPct(summary.medianTotalCutPct, 1)}`;
  body += ".";
  if (summary.medianDaysToFirstCut != null)
    body += ` The first cut usually comes ${formatDays(summary.medianDaysToFirstCut)} after listing.`;
  if (summary.staleListings > 0)
    body += ` ${summary.staleListings} have been listed for 90+ days; they have the most room to negotiate.`;
  return { icon: RiPriceTag3Line, title: "Room to negotiate", body };
}

export function MarketCues({ summary }: { summary: SegmentSummary }) {
  const cues = [
    priceCue(summary),
    balanceCue(summary),
    speedCue(summary),
    negotiationCue(summary),
  ].filter((cue) => cue != null);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {cues.map((cue) => (
        <li
          key={cue.title}
          className="flex gap-3 rounded-2xl border bg-card p-5"
        >
          <cue.icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">{cue.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {cue.body}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
