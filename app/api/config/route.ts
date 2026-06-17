import { NextResponse } from "next/server";

import { sql } from "@/db";
import { anchor, env } from "@/lib/env";
import type { AppConfig } from "@/lib/types";

export async function GET() {
  const areas = await sql<{ code: string; name: string; count: number }[]>`
    SELECT cadastral_code AS code, cadastral_name AS name, count(*)::int AS count
    FROM listings
    WHERE is_active AND cadastral_code IS NOT NULL
    GROUP BY 1, 2
    ORDER BY count DESC, name
  `;
  const [{ max }] = await sql<{ max: number | null }[]>`
    SELECT max(price)::float8 AS max FROM listings WHERE is_active AND price > 0
  `;

  const config: AppConfig = {
    anchor,
    areas,
    priceMax: max,
    feedWindowHours: env.FEED_WINDOW_HOURS,
  };
  return NextResponse.json(config);
}
