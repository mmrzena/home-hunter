"use client";

import {
  environmentManager,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { toast } from "sonner";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: QueryErrorMeta;
    mutationMeta: QueryErrorMeta;
  }
}

// Registered meta must extend Record<string, unknown> (TanStack docs).
interface QueryErrorMeta extends Record<string, unknown> {
  /** Toast title shown on error; defaults to a generic message. */
  errorMessage?: string;
  /** Set when the caller renders the error itself (error boundary, inline state). */
  skipErrorToast?: boolean;
}

function showErrorToast(error: Error, meta: QueryErrorMeta | undefined) {
  if (meta?.skipErrorToast) {
    return;
  }
  toast.error(meta?.errorMessage ?? "Something went wrong", {
    description: error.message,
  });
}

function makeQueryClient() {
  return new QueryClient({
    // Cache-level handlers fire once per failed query/mutation (component
    // onError fires per observer), so toasts don't stack up.
    queryCache: new QueryCache({
      onError: (error, query) => showErrorToast(error, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        showErrorToast(error, mutation.meta),
    }),
    defaultOptions: {
      queries: {
        // With SSR, a staleTime above 0 avoids refetching immediately on the
        // client for data the server already rendered.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always make a new query client so requests don't share state.
    return makeQueryClient();
  }
  // Browser: reuse one client so React suspending during initial render
  // doesn't recreate it and drop the cache.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
