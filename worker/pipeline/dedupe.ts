import { sql } from "@/db";

export type DedupeSummary = {
  active: number;
  edges: number;
  clusters: number;
  merged: number; // listings that share a cluster with at least one other
};

// Two dHashes within this Hamming distance count as "the same photo".
const HAMMING_MAX = 10;
// Usable-area tolerance for a dedupe edge.
const AREA_TOLERANCE = 0.1;
// Geo proximity for a dedupe edge, in metres.
const GEO_METRES = 50;

class UnionFind {
  private parent = new Map<number, number>();

  add(id: number) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: number): number {
    let root = id;
    while (this.parent.get(root) !== root)
      root = this.parent.get(root) as number;
    // path compression
    let node = id;
    while (this.parent.get(node) !== root) {
      const next = this.parent.get(node) as number;
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }

  union(a: number, b: number) {
    this.parent.set(this.find(a), this.find(b));
  }

  groups(): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const members = out.get(root);
      if (members) members.push(id);
      else out.set(root, [id]);
    }
    return out;
  }
}

/**
 * Clusters listings that are the same property listed more than once. An edge
 * requires geo ≤ 50 m, usable area within ±10%, the same deal type, AND at
 * least one shared photo (Hamming ≤ 10). Far-geo photo matches are deliberately
 * NOT edges — those are the stolen-photo scam signal, handled in scoring.
 */
export async function dedupe(): Promise<DedupeSummary> {
  const edgeRows = await sql<{ a_id: string; b_id: string }[]>`
    WITH candidates AS (
      SELECT a.id AS a_id, b.id AS b_id
      FROM listings a
      JOIN listings b
        ON a.id < b.id
       AND a.is_active AND b.is_active
       AND a.deal_type = b.deal_type
       AND a.usable_area_m2 IS NOT NULL AND b.usable_area_m2 IS NOT NULL
       AND abs(a.usable_area_m2 - b.usable_area_m2)
           <= ${AREA_TOLERANCE}::float8 * greatest(a.usable_area_m2, b.usable_area_m2)
       AND a.geom IS NOT NULL AND b.geom IS NOT NULL
       AND ST_DWithin(a.geom::geography, b.geom::geography, ${GEO_METRES})
    )
    SELECT c.a_id, c.b_id
    FROM candidates c
    WHERE EXISTS (
      SELECT 1
      FROM listing_image_hashes ha
      JOIN listing_image_hashes hb ON hb.listing_id = c.b_id
      WHERE ha.listing_id = c.a_id
        AND bit_count((ha.dhash # hb.dhash)::bit(64)) <= ${HAMMING_MAX}
    )
  `;

  const actives = await sql<{ id: string; price: string | null }[]>`
    SELECT id, price FROM listings WHERE is_active
  `;

  const priceById = new Map<number, number | null>();
  const uf = new UnionFind();
  for (const row of actives) {
    const id = Number(row.id);
    uf.add(id);
    priceById.set(id, row.price === null ? null : Number(row.price));
  }
  for (const edge of edgeRows) uf.union(Number(edge.a_id), Number(edge.b_id));

  const groups = uf.groups();

  // Recompute clustering from scratch — simplest correct, and idempotent.
  await sql`UPDATE listings SET cluster_id = NULL WHERE cluster_id IS NOT NULL`;
  await sql`TRUNCATE clusters RESTART IDENTITY`;

  let merged = 0;
  for (const members of groups.values()) {
    const priced = members
      .map((id) => ({ id, price: priceById.get(id) ?? null }))
      .filter(
        (member): member is { id: number; price: number } =>
          member.price !== null,
      );

    const representative = priced.length
      ? priced.reduce((lowest, member) =>
          member.price < lowest.price ? member : lowest,
        ).id
      : members[0];
    const prices = priced.map((member) => member.price);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    const [cluster] = await sql<{ id: string }[]>`
      INSERT INTO clusters (representative_listing_id, min_price, max_price, member_count)
      VALUES (${representative}, ${minPrice}, ${maxPrice}, ${members.length})
      RETURNING id
    `;
    await sql`
      UPDATE listings SET cluster_id = ${Number(cluster.id)}
      WHERE id = ANY(${members})
    `;
    if (members.length > 1) merged += members.length;
  }

  const summary: DedupeSummary = {
    active: actives.length,
    edges: edgeRows.length,
    clusters: groups.size,
    merged,
  };
  console.log("dedupe done:", summary);
  return summary;
}
