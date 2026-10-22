import Link from "next/link";
import {
  MARKET_SEGMENTS,
  type MarketSegment,
  SEGMENT_HINT,
  SEGMENT_LABEL,
  segmentHref,
} from "@/lib/market-trends";
import { cn } from "@/lib/utils";

export function SegmentTabs({ active }: { active: MarketSegment }) {
  return (
    <nav aria-label="Area" className="flex flex-wrap gap-1.5">
      {MARKET_SEGMENTS.map((segment) => (
        <Link
          key={segment}
          href={segmentHref(segment)}
          aria-current={segment === active ? "page" : undefined}
          title={SEGMENT_HINT[segment]}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            segment === active
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {SEGMENT_LABEL[segment]}
        </Link>
      ))}
    </nav>
  );
}
