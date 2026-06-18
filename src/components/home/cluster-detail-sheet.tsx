"use client";

import {
  RiAlertLine,
  RiArrowRightUpLine,
  RiCheckboxCircleLine,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatArea,
  formatDistance,
  formatKind,
  formatPerM2,
  formatPrice,
} from "@/lib/format";
import { statusBadge, TONE_BADGE } from "@/lib/listing-status";
import { triageStore, useTriage } from "@/lib/triage-store";
import type { ClusterCard } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PercentileMeter } from "./percentile-meter";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ClusterDetailSheet({
  card,
  open,
  onOpenChange,
  anchorLabel,
}: {
  card: ClusterCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorLabel: string | null;
}) {
  const badge = card ? statusBadge(card) : null;
  const { shortlisted } = useTriage();
  const isShortlisted = card ? shortlisted.has(card.clusterId) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {card && (
          <>
            <SheetHeader className="gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {badge && (
                  <Badge className={TONE_BADGE[badge.tone]}>
                    {badge.label}
                  </Badge>
                )}
                {card.isNew && <Badge variant="secondary">New</Badge>}
                {card.priceDropPct != null && card.priceDropPct >= 3 && (
                  <Badge variant="outline">
                    −{Math.round(card.priceDropPct)}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-2xl">
                  {formatPrice(card.price)}
                </SheetTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    isShortlisted && "border-amber-400/70 text-amber-600",
                  )}
                  onClick={() => triageStore.toggleShortlist(card.clusterId)}
                >
                  {isShortlisted ? (
                    <RiStarFill className="size-4 text-amber-500" />
                  ) : (
                    <RiStarLine className="size-4" />
                  )}
                  {isShortlisted ? "Shortlisted" : "Shortlist"}
                </Button>
              </div>
              <SheetDescription>
                {formatKind(card.propertyKind)} ·{" "}
                {card.cadastralName ?? card.localityText ?? "—"}
                {card.memberCount > 1 &&
                  ` · ${card.memberCount} ads ${formatPrice(card.minPrice)}–${formatPrice(card.maxPrice)}`}
              </SheetDescription>
            </SheetHeader>

            {card.photos.length > 0 && (
              <div className="px-4">
                <Carousel className="w-full">
                  <CarouselContent>
                    {card.photos.map((src) => (
                      <CarouselItem key={src}>
                        {/* biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail */}
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-48 w-full rounded-md bg-muted object-cover"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {card.photos.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              </div>
            )}

            <div className="space-y-4 p-4">
              <PercentileMeter
                percentile={card.percentile}
                confidence={card.percentileConfidence}
                sampleSize={card.sampleSize}
              />

              <dl className="grid grid-cols-2 gap-3">
                <Fact
                  label="Usable area"
                  value={formatArea(card.usableAreaM2)}
                />
                <Fact label="Land" value={formatArea(card.landAreaM2)} />
                <Fact
                  label="CZK / usable m²"
                  value={formatPerM2(card.pricePerUsableM2)}
                />
                <Fact
                  label="CZK / land m²"
                  value={formatPerM2(card.pricePerLandM2)}
                />
                {card.disposition && (
                  <Fact label="Layout" value={card.disposition} />
                )}
                {card.distanceKm != null && (
                  <Fact
                    label={anchorLabel ? `From ${anchorLabel}` : "Distance"}
                    value={formatDistance(card.distanceKm)}
                  />
                )}
                <Fact
                  label="Seller"
                  value={
                    card.sellerName ??
                    (card.sellerType === "private" ? "Soukromá osoba" : "—")
                  }
                />
              </dl>

              {(card.dealReasons.length > 0 || card.scamReasons.length > 0) && (
                <>
                  <Separator />
                  <ul className="space-y-1.5">
                    {card.dealReasons.map((reason) => (
                      <li
                        key={reason.code}
                        className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400"
                      >
                        <RiCheckboxCircleLine className="mt-0.5 size-4 shrink-0" />
                        {reason.label}
                      </li>
                    ))}
                    {card.scamReasons.map((reason) => (
                      <li
                        key={reason.code}
                        className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400"
                      >
                        <RiAlertLine className="mt-0.5 size-4 shrink-0" />
                        {reason.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Listed at {card.memberCount}{" "}
                  {card.memberCount === 1 ? "place" : "places"}
                </p>
                <ul className="space-y-1.5">
                  {card.members.map((member) => (
                    <li
                      key={`${member.source}:${member.sourceId}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="capitalize">{member.source}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {formatPrice(member.price)}
                        </span>
                        {member.url && (
                          <a
                            href={member.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            <RiArrowRightUpLine className="size-4" />
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {card.url && (
                <Button asChild className="w-full">
                  <a href={card.url} target="_blank" rel="noreferrer">
                    Open on Sreality <RiArrowRightUpLine className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
