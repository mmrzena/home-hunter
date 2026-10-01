import type { RawListing } from "../sources/types";

export type IngestSource = "sreality" | "bezrealitky" | "ceskereality";
export type PipelineState = {
  phase:
    | "ingest"
    | "landIngest"
    | "hash"
    | "bucket"
    | "landPrice"
    | "edges"
    | "clusters"
    | "score"
    | "done";
  sources: IngestSource[];
  maxPages: number;
  sourceIndex: number;
  regionIndex: number;
  page: number;
  pageItems: RawListing[] | null;
  itemIndex: number;
  pageComplete: boolean;
  sourceComplete: boolean;
  sourceSeen: number;
  cursor: number;
  seen: number;
  hashed: number;
  scored: number;
  warnings: string[];
};

export function initialState(
  sources: IngestSource[],
  maxPages: number,
): PipelineState {
  return {
    phase: "ingest",
    sources,
    maxPages,
    sourceIndex: 0,
    regionIndex: 0,
    page: 1,
    pageItems: null,
    itemIndex: 0,
    pageComplete: false,
    sourceComplete: true,
    sourceSeen: 0,
    cursor: 0,
    seen: 0,
    hashed: 0,
    scored: 0,
    warnings: [],
  };
}

export function nextPhase(state: PipelineState, phase: PipelineState["phase"]) {
  state.phase = phase;
  state.cursor = 0;
}

export function resetSourceCursor(state: PipelineState) {
  state.regionIndex = 0;
  state.page = 1;
  state.sourceSeen = 0;
  state.sourceComplete = true;
}

/** Land ingest walks its own sources with the same crawl cursors ingest used. */
export function startLandIngest(state: PipelineState) {
  nextPhase(state, "landIngest");
  state.sourceIndex = 0;
  state.pageItems = null;
  resetSourceCursor(state);
}
