---
name: state-management
description: Choose the right state tool in this Next.js + React 19 repo — useState, useReducer, TanStack Query, Zustand, Jotai, react-hook-form, or just Server Components. Use when adding or refactoring state, fetching or mutating server data from a client component, deciding where data should live, lifting state, or when a component's useState calls are multiplying.
---

# State management in this starter kit

Pick the simplest tool that fits. Escalate only when the current one hurts.
Default to **not** holding state at all — derive it or render it on the server.

## Decision ladder

1. **No state — derive or render on the server.**
   If a value can be computed from props/other state, compute it inline (don't
   mirror it in `useState`). If it's static or server-fetched data, keep the
   component a Server Component and pass data down — don't pull it into a client
   component just to render it. In a real app the page is a Server Component that
   fetches data and passes it to a client island (e.g. an extracted chart in the
   route's `_components/`); the `OrdersChart` in
   `stories/examples/DashboardOverview.stories.tsx` shows that island's shape.

2. **`useState` — local, independent UI state.**
   A handful of unrelated values: open/closed, a search box, a selected tab.
   This is the default for component-local interactivity. Examples:
   `stories/examples/Shipments.stories.tsx`, `Customers.stories.tsx`.

3. **`useReducer` — local state with many interrelated transitions.**
   Reach for it when one component accumulates ~4+ `useState` calls that change
   together, or when updates are a small state machine (wizard steps, edit/draft
   buffers, multi-field filters with interdependencies). One reducer + typed
   actions beats a pile of setters.

4. **Form state — `react-hook-form` + `zod`.** Already the repo convention; do
   not hand-roll form state with `useState`. See the add-customer dialog in
   `stories/examples/Customers.stories.tsx`.

5. **Server state in client components — TanStack Query.**
   Installed and wired: `QueryProvider` (`src/components/query-provider.tsx`)
   wraps the app in `app/layout.tsx`, so `useQuery`/`useMutation` work in any
   client component. Reach for it when a *client* component needs to fetch,
   poll, or mutate server data — never `useEffect` + `useState` + `fetch`.
   Server Components still fetch directly (step 1); Query is for client-side
   reads, refetch-on-invalidate after mutations, polling, and optimistic
   updates. Close dialogs in the mutation's `onSuccess`, not on submit (repo
   convention). Default `staleTime` is 60s — override per query, don't change
   the global default casually.
   **Errors toast automatically** — `QueryProvider` has cache-level `onError`
   handlers wired to sonner, so don't add per-component error toasts. Tune via
   typed `meta` on the query/mutation: `meta: { errorMessage: "Couldn't load
   shipments" }` for a human title, `meta: { skipErrorToast: true }` when the
   component renders the error itself (inline state or error boundary).
   Worked `useMutation` examples: `app/sign-in/_components/sign-in-form.tsx`
   (pending state, rethrowing better-auth's `{ error }` result) and
   `src/components/auth/auth-status.tsx` (navigate in `onSuccess`).

6. **`zustand` — app-wide client state shared across routes/components.**
   When state must outlive a single component tree and be read/written from
   unrelated places (e.g. a cart, a command palette, cross-page UI prefs). One
   store, selector-based reads. NOT installed yet — see below.

7. **`jotai` — fine-grained shared atoms.**
   When shared state is naturally a set of small independent pieces and you want
   to avoid re-rendering everything on every change (atomized derived values,
   per-widget shared toggles). Prefer it over Zustand when the state is many
   small atoms rather than one cohesive store. NOT installed yet — see below.

## Rules of thumb

- **Lift, don't duplicate.** Shared state goes to the nearest common owner
  before reaching for a global store. Most "we need global state" is solved by
  lifting one level.
- **Server data isn't client state.** Don't load lists into `useState` to render
  them; render in a Server Component. When a client component genuinely owns the
  fetch, that's TanStack Query (step 5), not `useState`. Use client state only
  for what the *user* is actively changing.
- **Keep stores thin.** A Zustand/Jotai store holds state + actions, not view
  logic. Components stay dumb.

## Installing zustand / jotai

Neither is a dependency yet. When you genuinely hit step 6 or 7, install with the
repo toolchain (see CLAUDE.md): Node 24 via nvm, no global installs, and
`.npmrc` `min-release-age=7` (npm refuses packages published in the last 7 days):

```bash
nvm use 24 && npm install zustand   # or: jotai
```

If install fails on `min-release-age`, the version is too new — pin a slightly
older one rather than disabling the guard.
