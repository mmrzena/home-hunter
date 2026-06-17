import { Suspense } from "react";

import { HomeScreen } from "@/components/home/home-screen";

// The whole app is one screen: a map + a deduped, scored feed of houses.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
