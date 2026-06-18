import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * One scoring reason shown on a card. `weight` is the contribution to the
 * scam score (caution flags) or a 0..1 strength (deal flags).
 */
export type Reason = { code: string; label: string; weight: number };

export type SourceName = "sreality" | "bezrealitky" | "ceskereality";
export type BucketSource = "polygon" | "locality";
export type DealVerdict = "deal" | "fair" | "overpriced";

/**
 * One normalized listing from one source. Deduped listings keep their own row
 * and point at a shared `cluster_id`. `geom` (a generated PostGIS Point) and the
 * GiST index are added in the hand-written migration, not here.
 */
export const listings = pgTable(
  "listings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    dealType: text("deal_type").notNull().default("sell"),
    propertyKind: text("property_kind"),

    price: bigint("price", { mode: "number" }),
    currency: text("currency").notNull().default("CZK"),
    rentCharges: bigint("rent_charges", { mode: "number" }),

    usableAreaM2: integer("usable_area_m2"),
    builtUpAreaM2: integer("built_up_area_m2"),
    landAreaM2: integer("land_area_m2"),
    disposition: text("disposition"),

    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    localityText: text("locality_text"),

    // Assigned during bucketing.
    cadastralCode: text("cadastral_code"),
    cadastralName: text("cadastral_name"),
    bucketSource: text("bucket_source").$type<BucketSource>(),
    sizeBand: text("size_band"),

    sellerType: text("seller_type"),
    sellerName: text("seller_name"),
    hasIco: boolean("has_ico"),

    description: text("description"),
    url: text("url"),
    photos: text("photos").array().notNull(),
    labels: text("labels").array().notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),

    clusterId: bigint("cluster_id", { mode: "number" }),

    // Assigned during scoring.
    pricePerUsableM2: integer("price_per_usable_m2"),
    pricePerLandM2: integer("price_per_land_m2"),
    bucketKey: text("bucket_key"),
    percentile: doublePrecision("percentile"),
    percentileConfidence: text("percentile_confidence"),
    sampleSize: integer("sample_size"),
    dealVerdict: text("deal_verdict").$type<DealVerdict>(),
    isGoodDeal: boolean("is_good_deal"),
    scamScore: integer("scam_score"),
    scamReasons: jsonb("scam_reasons").$type<Reason[]>(),
    dealReasons: jsonb("deal_reasons").$type<Reason[]>(),
    priceDropPct: doublePrecision("price_drop_pct"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
  },
  (table) => [
    unique("listings_source_source_id").on(table.source, table.sourceId),
  ],
);

/** One perceptual hash per listing image (64-bit dHash, no bytes stored). */
export const imageHashes = pgTable(
  "listing_image_hashes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: bigint("listing_id", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    dhash: bigint("dhash", { mode: "bigint" }).notNull(),
  },
  (table) => [
    unique("image_hash_listing_position").on(table.listingId, table.position),
  ],
);

/** Appended whenever a listing's price changes between ingests. */
export const priceHistory = pgTable("price_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  listingId: bigint("listing_id", { mode: "number" }).notNull(),
  price: bigint("price", { mode: "number" }).notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A dedup cluster — the same flat/house listed across sources/agents. */
export const clusters = pgTable("clusters", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  representativeListingId: bigint("representative_listing_id", {
    mode: "number",
  }).notNull(),
  minPrice: bigint("min_price", { mode: "number" }),
  maxPrice: bigint("max_price", { mode: "number" }),
  memberCount: integer("member_count").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cadastral / municipal boundary polygons (ČÚZK katastrální území for Prague,
 * RÚIAN obce for Středočeský). `geom geometry(MultiPolygon,4326)` + GiST index
 * are added in the hand-written migration; seeded via ST_GeomFromGeoJSON.
 */
export const areas = pgTable("areas", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'katastr' | 'obec'
  region: text("region").notNull(), // 'praha' | 'stredocesky'
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type Area = typeof areas.$inferSelect;
