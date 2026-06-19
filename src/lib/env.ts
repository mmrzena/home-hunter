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

  // Connection-pool size. Keep high for the worker (batch); set to 1 on Vercel
  // serverless, where each function instance has its own pool behind Neon's pooler.
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Optional anchor point for straight-line commute distance + bearing.
  ANCHOR_LAT: z.coerce.number().min(-90).max(90).optional(),
  ANCHOR_LNG: z.coerce.number().min(-180).max(180).optional(),
  ANCHOR_LABEL: z.string().optional(),

  // Ingest tuning.
  // Secondary sources are live + verified, so they run by default; set the flag
  // to "false" to drop one (e.g. to ingest Sreality only).
  ENABLE_BEZREALITKY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  ENABLE_CESKEREALITY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  INGEST_MAX_PAGES: z.coerce.number().int().positive().default(40),
  REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(1200),
  IMAGE_CONCURRENCY: z.coerce.number().int().positive().default(3),
  MAX_IMAGES_PER_LISTING: z.coerce.number().int().positive().default(8),

  // Feed window for "new / price-changed" listings, in hours.
  FEED_WINDOW_HOURS: z.coerce.number().int().positive().default(48),

  // Auth (better-auth + Google). All optional so the worker and a fresh local
  // checkout boot without them; sign-in simply stays disabled until they're set.
  // BETTER_AUTH_SECRET signs sessions; generate with `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().optional(),
  // Public base URL of the app (e.g. https://home-hunter.vercel.app). Defaults
  // to localhost for dev; set on Vercel so OAuth redirects resolve.
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Comma-separated allowlist of Google emails permitted to sign in. One today;
  // add a second to flip this into a two-user tool — the data is keyed per user.
  ALLOWED_EMAILS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export const env = envSchema.parse(process.env);

// Sign-in is only offered when Google OAuth + a session secret are configured.
export const isAuthConfigured =
  env.GOOGLE_CLIENT_ID !== undefined &&
  env.GOOGLE_CLIENT_SECRET !== undefined &&
  env.BETTER_AUTH_SECRET !== undefined;

export const anchor =
  env.ANCHOR_LAT !== undefined && env.ANCHOR_LNG !== undefined
    ? {
        lat: env.ANCHOR_LAT,
        lng: env.ANCHOR_LNG,
        label: env.ANCHOR_LABEL ?? "Anchor",
      }
    : null;

export type Anchor = NonNullable<typeof anchor>;
