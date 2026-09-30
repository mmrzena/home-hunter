export class UnionFind {
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
