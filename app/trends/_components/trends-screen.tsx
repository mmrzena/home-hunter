import { RiInformationLine } from "@remixicon/react";
import { AppHeader } from "@/components/app-header";
import { formatDate } from "@/lib/format";
import type { MarketTrends } from "@/lib/market-trends";
import { MarketStats } from "./market-stats";
import { PriceCutsChart } from "./price-cuts-chart";
import { PriceTrendChart } from "./price-trend-chart";
import { SegmentTable } from "./segment-table";
import { SegmentTabs } from "./segment-tabs";
import { SupplyChart } from "./supply-chart";
import { TrendCard } from "./trend-card";

export function TrendsScreen({
  trends,
  isAuthEnabled,
}: {
  trends: MarketTrends;
  isAuthEnabled: boolean;
}) {
  const summary = trends.summaries.find(
    (row) => row.segment === trends.segment,
  );
  const weekCount = trends.weekly.length;
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="trends" isAuthEnabled={isAuthEnabled} />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
          {trends.observedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last checked {formatDate(trends.observedAt)}, {weekCount} weeks of
              history.
            </p>
          )}
          <div className="mt-4">
            <SegmentTabs active={trends.segment} />
          </div>
        </div>

        {summary == null || weekCount === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-muted-foreground">
            No houses tracked in this area yet.
          </p>
        ) : (
          <>
            <MarketStats summary={summary} />
            <TrendCard
              title="Asking price per m²"
              description="Median for houses on the market each week; the band holds the middle half."
            >
              <PriceTrendChart weekly={trends.weekly} />
            </TrendCard>
            <div className="grid gap-8 lg:grid-cols-2">
              <TrendCard
                title="Houses on the market"
                description="Adverts live at the end of each week."
              >
                <SupplyChart weekly={trends.weekly} />
              </TrendCard>
              <TrendCard
                title="Price cuts"
                description="Asking-price reductions spotted each week."
              >
                <PriceCutsChart weekly={trends.weekly} />
              </TrendCard>
            </div>
            <TrendCard
              title="Compare areas"
              description="Houses merge duplicate adverts; the other columns count adverts."
            >
              <SegmentTable
                summaries={trends.summaries}
                active={trends.segment}
              />
            </TrendCard>
          </>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <RiInformationLine className="mt-0.5 size-4 shrink-0" />
          Asking prices, not completed sales. "Gone" means an advert left every
          portal, usually a sale but sometimes a withdrawal. Adverts already up
          when an area was first crawled don't count as new and their time on
          the market is left out.
        </p>
      </main>
    </div>
  );
}
