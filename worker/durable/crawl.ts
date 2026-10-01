import type { TransactionSql } from "postgres";
import { type PipelineState, resetSourceCursor } from "./state";

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
