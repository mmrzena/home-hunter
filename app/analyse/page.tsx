import type { Metadata } from "next";
import { Suspense } from "react";
import { isAuthConfigured } from "@/lib/env";
import { AnalysisScreen } from "./_components/analysis-screen";

export const metadata: Metadata = {
  title: "House analysis · home-hunter",
  description:
    "Paste a house listing. Explore its price, location and the details that matter.",
};

export default function AnalysePage() {
  // useSearchParams (the analysed URL) needs a Suspense boundary on a static page.
  return (
    <Suspense fallback={null}>
      <AnalysisScreen isAuthEnabled={isAuthConfigured} />
    </Suspense>
  );
}
