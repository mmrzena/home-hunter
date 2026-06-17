"use client";

import {
  RiArrowLeftLine,
  RiErrorWarningLine,
  RiHome4Line,
} from "@remixicon/react";
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

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
              <RiErrorWarningLine />
            </EmptyMedia>
            <EmptyTitle>Something went wrong</EmptyTitle>
            <EmptyDescription>
              An unexpected error occurred. Try again, or head back home.
              {error.digest ? (
                <span className="mt-2 block font-mono text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </span>
              ) : null}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button onClick={reset}>Try again</Button>
              <Button asChild variant="outline">
                <Link href="/">
                  <RiArrowLeftLine /> Back home
                </Link>
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    </main>
  );
}
