import { NextResponse } from "next/server";
import { z } from "zod";
import { analyseHouse } from "@/lib/analyse-house";
import {
  ListingImportError,
  parseListingUrl,
} from "../../../worker/lib/listing-url";

export const runtime = "nodejs";
export const maxDuration = 60;
const INPUT = z.object({ url: z.string().trim().min(1).max(2048) });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 4096)
    return NextResponse.json(
      { error: "The request is too large." },
      { status: 413 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a listing URL." }, { status: 400 });
  }
  const parsed = INPUT.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Paste a complete listing URL (up to 2,048 characters)." },
      { status: 400 },
    );
  try {
    const target = parseListingUrl(parsed.data.url);
    const analysis = await analyseHouse(target);
    return NextResponse.json(analysis, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ListingImportError)
      return NextResponse.json({ error: error.message }, { status: 422 });
    console.error(
      "House analysis failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "The analysis could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
