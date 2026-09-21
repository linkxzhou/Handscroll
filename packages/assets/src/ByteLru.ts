export class ByteLru<T> {
  private readonly entries = new Map<
    string,
    { value: T; bytes: number; pinned: boolean; last: number }
  >();
  private used = 0;
  private clock = 0;

  constructor(private budgetBytes: number) {}

  setBudget(bytes: number): void {
    this.budgetBytes = bytes;
    this.evict();
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.used;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    entry.last = ++this.clock;
    return entry.value;
  }

  set(key: string, value: T, bytes: number, pinned = false): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.used -= existing.bytes;
      this.entries.delete(key);
    }
    this.entries.set(key, { value, bytes, pinned, last: ++this.clock });
    this.used += bytes;
    this.evict();
  }

  pin(key: string): void {
    const entry = this.entries.get(key);
    if (entry) entry.pinned = true;
  }

  unpin(key: string): void {
    const entry = this.entries.get(key);
    if (entry) entry.pinned = false;
  }

  delete(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.used -= entry.bytes;
    return entry.value;
  }

  evict(): string[] {
    const removed: string[] = [];
    if (this.used <= this.budgetBytes) return removed;
    const victims = [...this.entries.entries()]
      .filter(([, e]) => !e.pinned)
      .sort((a, b) => a[1].last - b[1].last);
    for (const [key, entry] of victims) {
      if (this.used <= this.budgetBytes) break;
      this.entries.delete(key);
      this.used -= entry.bytes;
      removed.push(key);
    }
    return removed;
  }

  clear(): void {
    this.entries.clear();
    this.used = 0;
  }
}
