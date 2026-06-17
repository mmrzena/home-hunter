import { z } from "zod";

/**
 * Server-only configuration, validated once at import so a missing or malformed
 * value fails fast instead of surfacing deep in the pipeline. Shared by the
 * Next.js web app (read paths) and the ingest worker. Never import from a
 * Client Component — pass the values it needs through props or an API route.
 *
 * Defaults target the local docker-compose Postgres so a fresh checkout boots
 * without a `.env`. Set `ANCHOR_*` to your workplace/home to get commute
 * distances on every card.
 */
const envSchema = z.object({
  // Postgres + PostGIS connection. The compose default; override for Neon.
  DATABASE_URL: z
    .string()
    .default("postgres://hunter:hunter@localhost:5432/hunter"),

  // Optional anchor point for straight-line commute distance + bearing.
  ANCHOR_LAT: z.coerce.number().min(-90).max(90).optional(),
  ANCHOR_LNG: z.coerce.number().min(-180).max(180).optional(),
  ANCHOR_LABEL: z.string().optional(),

  // Ingest tuning.
  ENABLE_BEZREALITKY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  INGEST_MAX_PAGES: z.coerce.number().int().positive().default(40),
  REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(1200),
  IMAGE_CONCURRENCY: z.coerce.number().int().positive().default(3),
  MAX_IMAGES_PER_LISTING: z.coerce.number().int().positive().default(8),

  // Feed window for "new / price-changed" listings, in hours.
  FEED_WINDOW_HOURS: z.coerce.number().int().positive().default(48),
});

export const env = envSchema.parse(process.env);

export const anchor =
  env.ANCHOR_LAT !== undefined && env.ANCHOR_LNG !== undefined
    ? {
        lat: env.ANCHOR_LAT,
        lng: env.ANCHOR_LNG,
        label: env.ANCHOR_LABEL ?? "Anchor",
      }
    : null;

export type Anchor = NonNullable<typeof anchor>;
