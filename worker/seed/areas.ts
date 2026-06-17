import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { env } from "@/lib/env";

/**
 * Loads cadastral / municipal boundary polygons into the `areas` table so the
 * bucketer can resolve each listing's GPS to a canonical area via point-in-
 * polygon. Reads GeoJSON FeatureCollections from files or URLs given in env:
 *
 *   SEED_PRAHA_GEOJSON        path|url   (kind=katastr, region=praha)
 *   SEED_STREDOCESKY_GEOJSON  path|url   (kind=obec,    region=stredocesky)
 *   SEED_SRID                 EPSG code of the input (default 4326 / WGS84;
 *                             set 5514 for S-JTSK exports — they get transformed)
 *
 * Get Prague katastrální území from the IPR Praha open-data geoportal and
 * Středočeský obce from ČÚZK/RÚIAN, exported as WGS84 GeoJSON. With nothing
 * configured this is a no-op and bucketing falls back to the source locality
 * string — the app still works, buckets are just less consistent across sources.
 */

type Feature = {
  geometry: unknown;
  properties?: Record<string, unknown> | null;
  id?: string | number;
};

const NAME_KEYS = [
  "NAZEV",
  "nazev",
  "name",
  "NAZ_KU",
  "NAZ_OBEC",
  "TEXT",
  "NÁZEV",
];
const CODE_KEYS = [
  "KOD",
  "kod",
  "code",
  "KATUZE_KOD",
  "KOD_KU",
  "KOD_OBEC",
  "ICOB",
  "id",
];

function pick(
  props: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!props) return undefined;
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      return `${value}`;
    }
  }
  return undefined;
}

async function loadSource(source: string): Promise<Feature[]> {
  const raw = /^https?:\/\//.test(source)
    ? await (await fetch(source)).text()
    : await readFile(source, "utf8");
  const parsed = JSON.parse(raw) as { features?: Feature[] };
  if (!Array.isArray(parsed.features)) {
    throw new Error(`${source}: not a GeoJSON FeatureCollection`);
  }
  return parsed.features;
}

async function seedSource(
  sql: postgres.Sql,
  source: string,
  kind: string,
  region: string,
  srid: number,
) {
  const features = await loadSource(source);
  let inserted = 0;
  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    if (!feature.geometry) continue;
    const name = pick(feature.properties, NAME_KEYS) ?? `${region}-${index}`;
    const code =
      pick(feature.properties, CODE_KEYS) ??
      (feature.id !== undefined
        ? `${feature.id}`
        : `${region}:${name}:${index}`);
    const geojson = JSON.stringify(feature.geometry);
    await sql`
      INSERT INTO areas (code, name, kind, region, geom)
      VALUES (
        ${code}, ${name}, ${kind}, ${region},
        ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), ${srid}), 4326))
      )
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, geom = EXCLUDED.geom
    `;
    inserted += 1;
  }
  console.log(`seeded ${inserted} areas from ${source} (${kind}/${region})`);
}

async function main() {
  const praha = process.env.SEED_PRAHA_GEOJSON;
  const stredocesky = process.env.SEED_STREDOCESKY_GEOJSON;
  const srid = Number(process.env.SEED_SRID ?? 4326);

  if (!praha && !stredocesky) {
    console.log(
      "No SEED_PRAHA_GEOJSON / SEED_STREDOCESKY_GEOJSON set — skipping boundary seed.\n" +
        "Bucketing will fall back to the source locality string until boundaries are loaded.",
    );
    return;
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    if (praha) await seedSource(sql, praha, "katastr", "praha", srid);
    if (stredocesky)
      await seedSource(sql, stredocesky, "obec", "stredocesky", srid);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
