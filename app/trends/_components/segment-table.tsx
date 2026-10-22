import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDays,
  formatDecimal,
  formatPct,
  formatPerM2,
  formatPriceCompact,
  formatSignedPct,
} from "@/lib/format";
import {
  type MarketSegment,
  SEGMENT_HINT,
  SEGMENT_LABEL,
  type SegmentSummary,
  segmentHref,
} from "@/lib/market-trends";
import { cn } from "@/lib/utils";
import {
  cutShare,
  daysOnMarket,
  monthsOfSupply,
  sameHouseChange,
} from "./market-math";

export function SegmentTable({
  summaries,
  active,
}: {
  summaries: SegmentSummary[];
  active: MarketSegment;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            <TableHead className="text-right">Houses</TableHead>
            <TableHead className="text-right">Median price</TableHead>
            <TableHead className="text-right">Kč/m²</TableHead>
            <TableHead className="text-right">8-week change</TableHead>
            <TableHead className="text-right">Cut price</TableHead>
            <TableHead className="text-right">Days listed</TableHead>
            <TableHead className="text-right">Months of stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => {
            const months = monthsOfSupply(summary);
            const change = sameHouseChange(summary);
            const share = cutShare(summary);
            const days = daysOnMarket(summary);
            return (
              <TableRow
                key={summary.segment}
                className={cn(summary.segment === active && "bg-muted/60")}
              >
                <TableCell>
                  <Link
                    href={segmentHref(summary.segment)}
                    className="font-medium hover:underline"
                  >
                    {SEGMENT_LABEL[summary.segment]}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {SEGMENT_HINT[summary.segment]}
                  </p>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {summary.activeHouses}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPriceCompact(summary.medianPrice)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPerM2(summary.medianPpm2)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {change == null ? "—" : formatSignedPct(change)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {share == null ? "—" : formatPct(share * 100)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {days == null ? "—" : formatDays(days.median)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {months == null ? "—" : formatDecimal(months, 1)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
