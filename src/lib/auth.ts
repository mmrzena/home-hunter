import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { account, db, session, user, verification } from "@/db";
import { env } from "@/lib/env";

/**
 * better-auth server instance — Google sign-in over the shared Drizzle pool.
 * The drizzle adapter matches better-auth fields by JS property key, so the
 * schema's camelCase keys are passed through verbatim (see src/db/schema.ts).
 *
 * Sign-in is locked to ALLOWED_EMAILS: the create hook fires only when a brand
 * new user row would be inserted, so a disallowed Google account is rejected on
 * its first attempt and never persisted — while allowed accounts (already in
 * the table) log in without re-triggering it. Empty allowlist = nobody, so a
 * misconfigured deploy fails closed rather than open.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  // A fallback keeps `next build` (NODE_ENV=production, no env) from throwing;
  // a real deploy MUST set BETTER_AUTH_SECRET or sessions are forgeable.
  secret:
    env.BETTER_AUTH_SECRET ?? "insecure-placeholder-set-BETTER_AUTH_SECRET",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = newUser.email.toLowerCase();
          if (!env.ALLOWED_EMAILS.includes(email)) {
            throw new APIError("FORBIDDEN", {
              message: "This Google account isn't allowed to sign in.",
            });
          }
          return { data: newUser };
        },
      },
    },
  },
});
