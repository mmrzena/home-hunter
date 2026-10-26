import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { DEV_USER_ID, IS_DEV_WITHOUT_SIGN_IN } from "@/lib/contacts";

/** The signed-in user's id for a route handler, or null when signed out. */
export async function getSessionUserId(
  request: NextRequest,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function getUserIdOrDevUser(
  request: NextRequest,
): Promise<string | null> {
  const userId = await getSessionUserId(request);
  return userId ?? (IS_DEV_WITHOUT_SIGN_IN ? DEV_USER_ID : null);
}
