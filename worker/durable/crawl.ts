import type { TransactionSql } from "postgres";
import { HttpError } from "../lib/http";
import { type PipelineState, resetSourceCursor } from "./state";

// A search answered with one of these isn't going to work on retry: the
// endpoint moved, or the portal is refusing this client (Sreality has served
// 404 to cloud egress addresses while answering browsers at home).
const BLOCKED_STATUSES = [401, 403, 404, 451];

export function isSourceBlocked(error: unknown): error is HttpError {
  return error instanceof HttpError && BLOCKED_STATUSES.includes(error.status);
}

/**
 * Gives up on a source whose search is refused and moves the crawl to the next
 * one, so one portal blocking us costs that portal's refresh, not the day's
 * run. Nothing is deactivated: the rows just aren't seen today.
 */
export function skipBlockedSource(
  state: PipelineState,
  crawl: { table: "listings" | "land_listings"; source: string },
  error: HttpError,
) {
  state.warnings.push(
    `${crawl.source} (${crawl.table}): search returned HTTP ${error.status}; source skipped, its rows were kept active.`,
  );
  state.pageItems = null;
  state.sourceIndex++;
  resetSourceCursor(state);
}

/**
 * Moves a crawl on after a processed page: the next page, the next search of
 * the same source, or the next source. A source's unseen rows are deactivated
 * only when every one of its searches paginated to the end, so a capped or
 * failed crawl never removes adverts it didn't reach.
 */
export async function advanceCrawl(
  sql: TransactionSql,
  state: PipelineState,
  crawl: {
    table: "listings" | "land_listings";
    source: string;
    searchCount: number;
    hasMorePages: boolean;
    isSearchComplete: boolean;
    startedAt: string;
  },
) {
  if (crawl.hasMorePages && state.page < state.maxPages) {
    state.page++;
    return;
  }
  state.sourceComplete &&= crawl.isSearchComplete;
  if (state.regionIndex + 1 < crawl.searchCount) {
    state.regionIndex++;
    state.page = 1;
    return;
  }
  if (state.sourceComplete && state.sourceSeen > 0)
    await sql`UPDATE ${sql(crawl.table)} SET is_active = false WHERE source = ${crawl.source}
      AND is_active AND last_seen_at < ${crawl.startedAt}`;
  else
    state.warnings.push(
      `${crawl.source} (${crawl.table}): incomplete or empty crawl; unseen rows were kept active.`,
    );
  state.sourceIndex++;
  resetSourceCursor(state);
}
