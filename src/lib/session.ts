import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/** The signed-in user's id for a route handler, or null when signed out. */
export async function getSessionUserId(
  request: NextRequest,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}
