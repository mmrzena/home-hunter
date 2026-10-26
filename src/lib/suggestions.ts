import type { ContactStatus, Rating } from "@/db/schema";
import {
  type ClusterFilters,
  getClusters,
  getClustersByIds,
} from "@/lib/clusters";
import { selectContactsWithListings } from "@/lib/contacts-db";
import {
  buildProfile,
  type Example,
  type HouseFacts,
  MIN_EXAMPLES,
  type SuggestionLimit,
  type SuggestionRadiusKm,
  scoreHouse,
} from "@/lib/suggestion-score";
import type { ClusterCard, SuggestionResult } from "@/lib/types";

const CANDIDATE_LIMIT = 5000;

const STATUS_WEIGHT: Record<ContactStatus, number> = {
  contacted: 1.5,
  visit_planned: 2,
  visited: 2,
  offer: 4,
  rejected: -1.5,
};
const VERDICT_WEIGHT: Record<Rating, number> = {
  1: -2,
  2: -2,
  3: 1,
  4: 3,
  5: 3,
};

export type SuggestionRequest = {
  userId: string | null;
  likedIds: number[];
  hiddenIds: number[];
  filters: ClusterFilters;
  limit: SuggestionLimit;
  radiusKm: SuggestionRadiusKm | null;
};

function askingPrice(price: number | null): number | null {
  return price != null && price > 0 ? price : null;
}

function factsOf(card: ClusterCard): HouseFacts {
  return {
    lat: card.lat,
    lng: card.lng,
    price: askingPrice(card.price),
    usableAreaM2: card.usableAreaM2,
    landAreaM2: card.landAreaM2,
    propertyKind: card.propertyKind,
    settlementClass: card.settlementClass,
    nearestStationKm: card.nearestStationKm,
    percentile: card.percentile,
    placeName: card.cadastralName ?? card.localityText,
  };
}

type Contacts = {
  weightByCluster: Map<number, number>;
  untracked: Example[];
};

// A tracked advert resolves to its cluster, whose representative card supplies
// the facts; an advert we never crawled only has the snapshot saved with the
// contact. Rows arrive newest-updated first, so with several contacts on one
// house the latest one speaks for it.
async function loadContacts(userId: string | null): Promise<Contacts> {
  const contacts: Contacts = { weightByCluster: new Map(), untracked: [] };
  if (userId == null) return contacts;
  for (const { contact, listing } of await selectContactsWithListings(userId)) {
    const weight =
      contact.rating != null
        ? VERDICT_WEIGHT[contact.rating]
        : STATUS_WEIGHT[contact.status];
    if (listing?.clusterId != null) {
      if (!contacts.weightByCluster.has(listing.clusterId))
        contacts.weightByCluster.set(listing.clusterId, weight);
      continue;
    }
    contacts.untracked.push({
      lat: contact.lat,
      lng: contact.lng,
      price: askingPrice(contact.price),
      usableAreaM2: null,
      landAreaM2: null,
      propertyKind: null,
      settlementClass: null,
      nearestStationKm: null,
      percentile: null,
      placeName: null,
      weight,
      origin: "contacted",
    });
  }
  return contacts;
}

export async function getSuggestions(
  request: SuggestionRequest,
): Promise<SuggestionResult> {
  const [contacts, candidates] = await Promise.all([
    loadContacts(request.userId),
    getClusters({ ...request.filters, limit: CANDIDATE_LIMIT }, { slim: true }),
  ]);
  const liked = new Set(request.likedIds);
  const exampleCards = await getClustersByIds([
    ...liked,
    ...contacts.weightByCluster.keys(),
  ]);
  const profile = buildProfile([
    ...exampleCards.map((card): Example => {
      const contactWeight = contacts.weightByCluster.get(card.clusterId);
      return contactWeight != null
        ? { ...factsOf(card), weight: contactWeight, origin: "contacted" }
        : { ...factsOf(card), weight: 1, origin: "liked" };
    }),
    ...contacts.untracked,
  ]);
  const exampleCount = profile.positives.length;
  if (exampleCount < MIN_EXAMPLES) return { suggestions: [], exampleCount };

  const excluded = new Set([
    ...liked,
    ...request.hiddenIds,
    ...contacts.weightByCluster.keys(),
  ]);
  const ranked = candidates
    .filter((card) => !excluded.has(card.clusterId))
    .flatMap((card) => {
      const match = scoreHouse(factsOf(card), profile, request.radiusKm);
      return match ? [{ clusterId: card.clusterId, match }] : [];
    })
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, request.limit);

  const cardById = new Map(
    (await getClustersByIds(ranked.map((entry) => entry.clusterId))).map(
      (card) => [card.clusterId, card],
    ),
  );
  return {
    suggestions: ranked.flatMap(({ clusterId, match }) => {
      const card = cardById.get(clusterId);
      return card ? [{ card, match }] : [];
    }),
    exampleCount,
  };
}
