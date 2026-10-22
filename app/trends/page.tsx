import type { Metadata } from "next";
import { isAuthConfigured } from "@/lib/env";
import { getMarketTrends, parseSegment } from "@/lib/market-trends";
import { TrendsScreen } from "./_components/trends-screen";

export const metadata: Metadata = {
  title: "Market trends · home-hunter",
  description:
    "Asking prices, supply, price cuts and time on the market, week by week.",
};

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { area } = await searchParams;
  const trends = await getMarketTrends(parseSegment(area));
  return <TrendsScreen trends={trends} isAuthEnabled={isAuthConfigured} />;
}
