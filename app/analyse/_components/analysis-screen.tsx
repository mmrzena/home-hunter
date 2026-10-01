"use client";

import {
  RiArrowRightLine,
  RiLink,
  RiLoader4Line,
  RiSearchLine,
} from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { HouseAnalysis } from "@/lib/analysis-types";
import { AnalysisReport } from "./analysis-report";

export function AnalysisScreen({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  const [url, setUrl] = useState("");
  const analysis = useMutation({
    mutationFn: async (listingUrl: string): Promise<HouseAnalysis> => {
      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: listingUrl }),
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ??
            "The analysis could not be completed. Please try again.",
        );
      }
      return response.json();
    },
    retry: false,
    meta: { skipErrorToast: true },
  });
  const hasReport = analysis.isSuccess;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="analyse" isAuthEnabled={isAuthEnabled} />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <section
          className={hasReport ? "mb-10" : "mx-auto max-w-3xl py-6 sm:py-12"}
        >
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" />A closer look
            at your next home
          </p>
          <h1
            className={
              hasReport
                ? "text-3xl font-semibold tracking-tight"
                : "max-w-2xl text-4xl font-semibold leading-[1.13] tracking-tight sm:text-6xl"
            }
          >
            {hasReport ? (
              "One house. The whole picture."
            ) : (
              <>
                Found a house?
                <br />
                <span className="text-muted-foreground">
                  Get the whole picture.
                </span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Paste a listing to explore its asking price, nearby comparisons, and
            the details that make a house worth a closer look.
          </p>
          <form
            className="mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              analysis.mutate(url.trim());
            }}
          >
            <label
              htmlFor="listing-url"
              className="mb-2 block text-sm font-medium"
            >
              House listing URL
            </label>
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 sm:flex-row sm:items-center">
              <RiLink className="ml-3 hidden size-5 shrink-0 text-muted-foreground sm:block" />
              <Input
                id="listing-url"
                type="url"
                required
                maxLength={2048}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={analysis.isPending}
                placeholder="https://www.sreality.cz/detail/…"
                aria-describedby="supported-portals"
                className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                disabled={!url.trim() || analysis.isPending}
                className="h-12 rounded-xl px-6"
              >
                {analysis.isPending ? (
                  <>
                    <RiLoader4Line className="size-4 animate-spin" />
                    Analysing…
                  </>
                ) : (
                  <>
                    Analyse house
                    <RiArrowRightLine className="size-4" />
                  </>
                )}
              </Button>
            </div>
            <p
              id="supported-portals"
              className="mt-3 text-xs leading-relaxed text-muted-foreground"
            >
              Sreality · Bezrealitky · České reality · Realingo{" "}
              <span className="mx-2">/</span> Market coverage: Prague & Central
              Bohemia
            </p>
          </form>
          {analysis.isError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {analysis.error.name === "TimeoutError"
                ? "The analysis took too long. Please try again."
                : analysis.error.message}
            </div>
          )}
        </section>
        {analysis.isPending && (
          <section aria-live="polite" aria-busy="true" className="space-y-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <RiSearchLine className="size-5 animate-pulse" />
              Reading the listing and comparing it with the local market…
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
            <Skeleton className="h-28 rounded-2xl" />
          </section>
        )}
        {hasReport && (
          <AnalysisReport
            key={`${analysis.data.listing.source}:${analysis.data.listing.sourceId}:${analysis.data.fetchedAt}`}
            report={analysis.data}
          />
        )}
        {analysis.isIdle && (
          <section
            aria-label="What you will learn"
            className="mx-auto mt-10 grid max-w-3xl gap-8 border-t pt-8 sm:grid-cols-3"
          >
            {[
              [
                "01",
                "Understand the price",
                "See how the asking price compares with similar houses nearby.",
              ],
              [
                "02",
                "Explore the details",
                "Photos, floor area, plot size, seller and the full listing description.",
              ],
              [
                "03",
                "Know the context",
                "Location, train access, known price changes and signals to follow up.",
              ],
            ].map(([number, title, description]) => (
              <div key={number}>
                <span className="font-mono text-xs text-primary">{number}</span>
                <h2 className="mt-3 text-sm font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted-foreground sm:px-8">
        A little more clarity before the viewing.
      </footer>
    </div>
  );
}
