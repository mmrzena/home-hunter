import { RiArrowRightUpLine, RiMapPinLine } from "@remixicon/react";
import { ContactButton } from "@/components/contacts/contact-button";
import type { HouseAnalysis } from "@/lib/analysis-types";
import {
  formatArea,
  formatDistance,
  formatKind,
  formatPerM2,
  formatPopulation,
  formatPrice,
  formatSource,
} from "@/lib/format";
import { PriceAnalysis } from "./price-analysis";
import { PropertyGallery } from "./property-gallery";
import { TrainConnections } from "./train-connections";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function AnalysisReport({ report }: { report: HouseAnalysis }) {
  const { listing, location, valuation } = report;
  const facts = [
    ["Usable floor area", formatArea(listing.usableAreaM2)],
    ["Plot size", formatArea(listing.landAreaM2)],
    ["Layout", listing.disposition ?? "Not supplied"],
    [
      "Property type",
      listing.propertyKind === "recreational"
        ? "Recreational house"
        : formatKind(listing.propertyKind),
    ],
    ["Built-up area", formatArea(listing.builtUpAreaM2)],
    [
      "Price / plot m²",
      formatPerM2(
        listing.price && listing.landAreaM2
          ? listing.price / listing.landAreaM2
          : null,
      ),
    ],
  ];
  const locationFacts = [
    ["Prague centre", formatDistance(location.pragueKm)],
    ["Settlement", location.settlementClass ?? "Unknown"],
    ["Population", formatPopulation(location.population)],
    ...(location.anchorLabel
      ? [[location.anchorLabel, formatDistance(location.anchorKm)]]
      : []),
  ];
  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-8">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
            Your property report · {formatSource(listing.source)}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {listing.localityText ?? "House for sale"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read from the portal {DATE.format(new Date(report.fetchedAt))}
            {listing.postedAt &&
              ` · Listed ${DATE.format(new Date(listing.postedAt))}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {listing.url && (
            <ContactButton
              house={{
                source: listing.source,
                sourceId: listing.sourceId,
                url: listing.url,
                title: listing.localityText ?? null,
                price: listing.price ?? null,
                photo: listing.photos?.[0] ?? null,
                lat: listing.lat ?? null,
                lng: listing.lng ?? null,
              }}
              suggestedName={listing.sellerName}
              variant="button"
            />
          )}
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-muted"
          >
            Original listing
            <RiArrowRightUpLine className="size-4" />
          </a>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PropertyGallery
          photos={listing.photos ?? []}
          locality={listing.localityText}
        />
        <PriceAnalysis report={report} />
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-card p-5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-2 font-mono text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {report.warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6">
          <h3 className="text-sm font-semibold">Gaps in the picture</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      {listing.lat != null &&
        listing.lng != null &&
        location.stations.length > 0 && (
          <TrainConnections
            house={{ lat: listing.lat, lng: listing.lng }}
            stations={location.stations}
            pragueKm={location.pragueKm}
          />
        )}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">The neighbourhood</h3>
            <RiMapPinLine className="size-5 text-primary" />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-6">
            {locationFacts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-mono text-lg">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Distances are straight-line estimates from the advertised location.
            Settlement data cover Prague and Central Bohemia.
          </p>
          {listing.lat != null && listing.lng != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}#map=15/${listing.lat}/${listing.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Explore the location
              <RiArrowRightUpLine className="size-4" />
            </a>
          )}
        </section>
        <section className="rounded-2xl border p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Seller & signals</h3>
          <p className="mt-5 font-medium">
            {listing.sellerName ?? "Seller name not supplied"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {listing.sellerType === "agency"
              ? "Real estate agency"
              : listing.sellerType === "private"
                ? "Private seller"
                : "Seller type not supplied"}
            {listing.hasIco != null &&
              ` · ${listing.hasIco ? "IČO supplied" : "No IČO supplied"}`}
          </p>
          {report.descriptionFlag && (
            <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm">
              Description signal: {report.descriptionFlag}
            </p>
          )}
          {report.scoredAt ? (
            <div className="mt-5 border-t pt-5">
              <p className="text-sm">
                Saved caution score{" "}
                <span className="font-mono">
                  {report.storedScamScore ?? "—"}/100
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last checked {DATE.format(new Date(report.scoredAt))}; these
                signals may predate the current listing.
              </p>
              {report.storedReasons.length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                  {report.storedReasons.map((reason) => (
                    <li key={reason.code}>{reason.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No caution signals in the saved checks.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              This listing has no saved trust analysis. Cross-listing photo
              checks have not been run for this import.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Signals are prompts for follow-up, not a verification of the seller
            or property.
          </p>
        </section>
      </div>
      <section className="overflow-hidden rounded-2xl border">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">
              The houses behind the comparison
            </h3>
            <span className="font-mono text-xs text-muted-foreground">
              {valuation?.sampleSize ?? 0} independent houses
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {valuation?.bucketKey.startsWith("radius:")
              ? `Within ${valuation.bucketKey.slice(7)} of this house.`
              : valuation
                ? "In the same locality."
                : "Comparisons will appear when there is enough relevant market data."}{" "}
            Similar usable area
            {listing.propertyKind && listing.propertyKind !== "other"
              ? ", matching property type"
              : ""}
            , and comparable plot sizes when supplied. One advert per known
            house; the subject and its known duplicates are excluded. Only
            active adverts seen in the last 90 days are used.
          </p>
        </div>
        {report.comparables.length > 0 && (
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">
                All listings used for this asking-price comparison
              </caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {[
                    "Location / portal",
                    "Usable",
                    "Plot",
                    "Asking price",
                    "Price / m²",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-6 py-3 text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.comparables.map((peer) => (
                  <tr key={peer.id} className="hover:bg-muted/40">
                    <td className="px-6 py-4">
                      {peer.url ? (
                        <a
                          href={peer.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:text-primary"
                        >
                          {peer.locality ?? "View listing"}
                          <RiArrowRightUpLine className="size-3" />
                        </a>
                      ) : (
                        (peer.locality ?? "Unknown location")
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatSource(peer.source)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {formatArea(peer.usable)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {formatArea(peer.land)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {formatPrice(peer.price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {formatPerM2(peer.ppm2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Price history</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {report.firstSeenAt
              ? `First seen ${DATE.format(new Date(report.firstSeenAt))}.`
              : "This listing has not been tracked before."}
            {report.priceDropPct != null &&
              ` Current asking price is ${report.priceDropPct.toFixed(1)}% below its recorded peak.`}
          </p>
          {report.history.length > 0 ? (
            <ol className="mt-5 max-h-64 divide-y overflow-y-auto">
              {report.history.map((entry, index) => (
                <li
                  key={`${entry.seenAt}:${index}`}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {DATE.format(new Date(entry.seenAt))}
                  </span>
                  <span className="font-mono">{formatPrice(entry.price)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No recorded price changes. Importing a link does not add it to the
              daily tracking pipeline.
            </p>
          )}
        </section>
        <section className="rounded-2xl border p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Also listed at</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {report.members.length > 0
              ? `${report.members.length} active adverts previously matched to this house. Saved prices may differ from today's listing.`
              : "No linked adverts in the saved data. This does not rule out other listings."}
          </p>
          <ul className="mt-5 divide-y">
            {report.members.map((member) => (
              <li
                key={`${member.source}:${member.sourceId}`}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span>{formatSource(member.source)}</span>
                <span className="flex items-center gap-2 font-mono">
                  {formatPrice(member.price)}
                  {member.url && (
                    <a
                      href={member.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${formatSource(member.source)} listing`}
                      className="text-primary"
                    >
                      <RiArrowRightUpLine className="size-4" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rounded-2xl border p-6 sm:p-8">
        <h3 className="text-lg font-semibold">In the seller’s words</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Description imported from {formatSource(listing.source)}.
        </p>
        <p className="mt-6 max-w-4xl whitespace-pre-line text-sm leading-7 text-muted-foreground">
          {listing.description ?? "The portal did not provide a description."}
        </p>
      </section>
    </article>
  );
}
