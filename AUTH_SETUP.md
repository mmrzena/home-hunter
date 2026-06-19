# Auth setup (Google sign-in + cross-device triage)

The app signs in with Google (via [better-auth](https://better-auth.com)) so your
**seen** and **★ shortlist** follow you across devices. Browsing stays open —
signing in only unlocks the synced, server-backed triage. Without the env vars
below, the sign-in button simply never appears and the app behaves exactly as the
old no-account, localStorage-only tool.

## 1. Create a Google OAuth client (~5 min, one-time)

1. <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill the basics →
   add yourself as a **Test user** (so you don't need Google verification).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Application type **Web application**.
4. **Authorized JavaScript origins:**
   - `http://localhost:3000`
   - `https://<your-app>.vercel.app`
5. **Authorized redirect URIs** (better-auth's Google callback path):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google`
6. Copy the **Client ID** and **Client secret**.

## 2. Environment variables

Generate a session secret:

```bash
openssl rand -base64 32
```

Set these (locally in `.env.local`, and in **Vercel → Settings → Environment
Variables** for production):

| Var | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | the `openssl` output above |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally; `https://<your-app>.vercel.app` on Vercel |
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `ALLOWED_EMAILS` | your Google email. Comma-separate to add a second person later — that's the whole "make it two-user" change. |

`ALLOWED_EMAILS` is enforced server-side: a Google account not on the list is
rejected on its first sign-in and never stored. An **empty** allowlist blocks
everyone (fails closed).

## 3. Apply the migration

Migration `0002_auth_and_triage.sql` adds the better-auth tables + `user_triage`.
Run against whatever `DATABASE_URL` points at (local compose or Neon):

```bash
npm run db:migrate
```

## 4. Done

- Local: `npm run dev`, click **Sign in**.
- The first sign-in migrates this browser's existing localStorage triage up to
  your account, then keeps every device in sync.
- The default feed already hides your **seen** houses, so signing in anywhere
  shows only what you haven't triaged yet.
