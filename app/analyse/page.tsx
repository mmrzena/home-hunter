import type { Metadata } from "next";
import { isAuthConfigured } from "@/lib/env";
import { AnalysisScreen } from "./_components/analysis-screen";

export const metadata: Metadata = {
  title: "House analysis · home-hunter",
  description:
    "Paste a house listing. Explore its price, location and the details that matter.",
};

export default function AnalysePage() {
  return <AnalysisScreen isAuthEnabled={isAuthConfigured} />;
}
