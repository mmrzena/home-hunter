import { RiInformationLine } from "@remixicon/react";
import { AppHeader } from "@/components/app-header";
import { formatDate } from "@/lib/format";
import {
  type MarketTrends,
  SEGMENT_HINT,
  SEGMENT_LABEL,
} from "@/lib/market-trends";
import { FlowChart } from "./flow-chart";
import { MarketCues } from "./market-cues";
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
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <section>
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            The market, week by week
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Where prices are heading
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {SEGMENT_LABEL[trends.segment]}: {SEGMENT_HINT[trends.segment]}.{" "}
            {trends.observedAt &&
              `Last checked ${formatDate(trends.observedAt)}, ${weekCount} weeks of history.`}
          </p>
          <div className="mt-6">
            <SegmentTabs active={trends.segment} />
          </div>
        </section>

        {summary == null || weekCount === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-muted-foreground">
            No houses tracked in this area yet.
          </p>
        ) : (
          <>
            <MarketCues summary={summary} />
            <MarketStats summary={summary} />
            <TrendCard
              title="Asking price per m²"
              description="Median asking price per m² of usable area for houses on the market each week. The shaded band holds the middle half."
            >
              <PriceTrendChart weekly={trends.weekly} />
            </TrendCard>
            <div className="grid gap-8 lg:grid-cols-2">
              <TrendCard
                title="Houses on the market"
                description="Adverts live at the end of each week. Rising stock means more choice and more leverage."
              >
                <SupplyChart weekly={trends.weekly} />
              </TrendCard>
              <TrendCard
                title="Coming and going"
                description="New adverts against ones that disappeared (sold or withdrawn). More going than coming means a tightening market."
              >
                <FlowChart weekly={trends.weekly} />
              </TrendCard>
            </div>
            <TrendCard
              title="Price cuts"
              description="Asking-price reductions spotted each week. A rising count means sellers are giving way."
            >
              <PriceCutsChart weekly={trends.weekly} />
            </TrendCard>
            <TrendCard
              title="Compare areas"
              description="Where you get the most for your money, and where sellers are most flexible."
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
          Built from asking prices, not completed sales. "Gone" means an advert
          left every portal, which is usually a sale but can be a withdrawal.
          Counts are adverts, so a house listed by two agents counts twice
          (except "Houses", which merges duplicates). Adverts already listed
          when a portal or area was first crawled don't count as new, and their
          time on the market is left out.
        </p>
      </main>
    </div>
  );
}
