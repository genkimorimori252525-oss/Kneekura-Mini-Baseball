/** Exact memo keyed by the IEEE-754 bit patterns of a fixed-length list of finite
 * numbers (so -0 and 0 stay distinct, as the former "-0" string key did), with the
 * same bounded first-in-first-out eviction as the Map<string,number> it replaces.
 * Pure speed: no string formatting per lookup. */
export class ExactScalarMemoV1 {
  private readonly buckets = new Map<number, Entry>();
  private readonly ring: (Entry | undefined)[];
  private head = 0;
  private count = 0;
  private readonly floats: Float64Array;
  private readonly words: Uint32Array;
  constructor(private readonly width: number, private readonly capacity: number) {
    this.ring = new Array(capacity);
    this.floats = new Float64Array(width);
    this.words = new Uint32Array(this.floats.buffer);
  }
  /** Fill-and-hash: caller writes inputs through set(i, n), then calls find(). */
  set(i: number, n: number): void { this.floats[i] = n; }
  find(): number | undefined {
    const w = this.words, n = this.width * 2;
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < n; i++) h = Math.imul(h ^ w[i], 0x01000193);
    this.hash = h;
    for (let e = this.buckets.get(h); e !== undefined; e = e.next) {
      const k = e.key;
      let same = true;
      for (let i = 0; i < n; i++) if (k[i] !== w[i]) { same = false; break; }
      if (same) return e.value;
    }
    return undefined;
  }
  private hash = 0;
  /** Insert the key most recently passed to find() (which must have missed). */
  put(value: number): void {
    if (this.count === this.capacity) {
      const old = this.ring[this.head]!;
      const first = this.buckets.get(old.hash)!;
      if (first === old) { if (old.next) this.buckets.set(old.hash, old.next); else this.buckets.delete(old.hash); }
      else { let p = first; while (p.next !== old) p = p.next!; p.next = old.next; }
      this.count--;
    }
    const entry: Entry = { hash: this.hash, key: this.words.slice(), value, next: this.buckets.get(this.hash) };
    this.buckets.set(this.hash, entry);
    this.ring[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    this.count++;
  }
}
type Entry = { hash: number; key: Uint32Array; value: number; next: Entry | undefined };
