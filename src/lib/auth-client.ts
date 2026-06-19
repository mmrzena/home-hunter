import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. baseURL defaults to the current origin, so the same
 * build works on localhost and Vercel without configuration.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
