import { RiArrowLeftLine, RiCompass3Line, RiHome4Line } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <Link
          href="/"
          aria-label="home-hunter home"
          className="flex items-center gap-2 font-semibold"
        >
          <RiHome4Line className="size-5 text-primary" /> home-hunter
        </Link>

        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiCompass3Line />
            </EmptyMedia>
            <p className="text-sm font-semibold tracking-widest text-primary">
              404
            </p>
            <EmptyTitle>Page not found</EmptyTitle>
            <EmptyDescription>
              The page you’re looking for doesn’t exist or may have moved.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/">
                <RiArrowLeftLine /> Back home
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </main>
  );
}
