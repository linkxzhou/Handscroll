import { ByteLru } from "@handscroll/assets";

export interface CachedTile {
  key: string;
  bitmap: ImageBitmap;
  bytes: number;
}

export class TileCache {
  readonly lru: ByteLru<CachedTile>;

  constructor(budgetBytes: number) {
    this.lru = new ByteLru<CachedTile>(budgetBytes);
  }

  get(key: string): CachedTile | undefined {
    return this.lru.get(key);
  }

  set(tile: CachedTile, pinned: boolean): void {
    this.lru.set(tile.key, tile, tile.bytes, pinned);
  }

  pin(key: string): void {
    this.lru.pin(key);
  }

  unpin(key: string): void {
    this.lru.unpin(key);
  }

  delete(key: string): CachedTile | undefined {
    return this.lru.delete(key);
  }

  setBudget(bytes: number): void {
    this.lru.setBudget(bytes);
  }

  clear(): void {
    this.lru.clear();
  }
}
