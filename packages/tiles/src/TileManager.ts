import type { CachePolicy, VisibleTile } from "@handscroll/core";
import type { ViewportState } from "@handscroll/core";
import { AssetManager, PriorityQueue } from "@handscroll/assets";
import type { Priority } from "@handscroll/assets";
import { parseManifest, tileUrl, type TileManifest, type TileLevel } from "./parseManifest.ts";
import { selectLod } from "./LodSelector.ts";
import { TileCache } from "./TileCache.ts";

export interface NeededTile {
  key: string;
  level: TileLevel;
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  url: string;
  priority: Priority;
}

export class TileManager {
  private manifest: TileManifest | null = null;
  private baseUrl = "";
  private currentLevelId: string | undefined;
  private visible: VisibleTile[] = [];
  private readonly inflight = new Map<string, AbortLike>();
  private readonly cache: TileCache;
  private pending = false;
  private generation = 0;
  hysteresis = 0.12;

  constructor(
    private readonly assets: AssetManager,
    private readonly onWake: () => void,
    decodedBudgetBytes = 192 * 1024 * 1024,
  ) {
    this.cache = new TileCache(decodedBudgetBytes);
  }

  async load(rawManifest: unknown, baseUrl: string): Promise<void> {
    this.clear();
    this.manifest = parseManifest(rawManifest);
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.currentLevelId = undefined;
  }

  getManifest(): TileManifest | null {
    return this.manifest;
  }

  update(viewport: ViewportState, policy: CachePolicy, dpr: number): void {
    if (!this.manifest) {
      this.visible = [];
      return;
    }
    this.cache.setBudget(policy.decodedBudgetBytes);

    const lod = selectLod(this.manifest.levels, viewport.zoom, dpr, this.currentLevelId, this.hysteresis);
    this.currentLevelId = lod.level.id;

    const visW = viewport.screenWidth / viewport.zoom;
    const visH = viewport.screenHeight / viewport.zoom;
    const view = {
      left: viewport.centerX - visW / 2,
      top: viewport.centerY - visH / 2,
      right: viewport.centerX + visW / 2,
      bottom: viewport.centerY + visH / 2,
    };
    const preload = {
      left: view.left - visW * 0.5,
      top: view.top - visH * 0.5,
      right: view.right + visW * 0.5,
      bottom: view.bottom + visH * 0.5,
    };

    const needed = this.collectTiles(lod.level, preload, view);
    const neededKeys = new Set(needed.map((t) => t.key));

    for (const key of [...this.inflight.keys()]) {
      if (!neededKeys.has(key)) {
        this.inflight.get(key)?.cancel();
        this.inflight.delete(key);
        const cached = this.visible.find((t) => t.key === key);
        if (cached) this.assets.cancel(cached.url);
      }
    }

    for (const key of [...neededKeys]) {
      this.cache.unpin(key);
    }
    const displayKeys = new Set<string>();
    for (const tile of needed) {
      if (rectsOverlap(toRect(tile), view)) {
        this.cache.pin(tile.key);
        displayKeys.add(tile.key);
      }
    }

    const queue = new PriorityQueue<NeededTile>();
    for (const tile of needed) {
      if (this.cache.get(tile.key)) continue;
      if (this.inflight.has(tile.key)) continue;
      queue.push({ key: tile.key, priority: tile.priority, value: tile });
    }

    let inflight = this.inflight.size;
    while (inflight < policy.maxConcurrentRequests && queue.length > 0) {
      const item = queue.pop();
      if (!item) break;
      this.startLoad(item.value);
      inflight += 1;
    }

    const nextVisible: VisibleTile[] = [];
    let uploads = 0;
    for (const tile of needed) {
      if (!rectsOverlap(toRect(tile), view) && !this.cache.get(tile.key)) continue;
      const cached = this.cache.get(tile.key);
      const ready = Boolean(cached);
      if (ready) uploads += 1;
      if (ready && uploads > policy.maxUploadsPerFrame && !displayKeys.has(tile.key)) {
        continue;
      }
      if (!rectsOverlap(toRect(tile), view)) continue;
      nextVisible.push({
        key: tile.key,
        levelId: tile.level.id,
        col: tile.col,
        row: tile.row,
        worldX: tile.worldX,
        worldY: tile.worldY,
        worldWidth: tile.worldWidth,
        worldHeight: tile.worldHeight,
        url: tile.url,
        ready,
        bitmap: cached?.bitmap,
        priority: tile.priority,
      });
    }

    // Fallback: if the current level isn't ready, show any coarser cached tiles that cover the view.
    if (nextVisible.every((t) => !t.ready)) {
      const fallback = this.visible.filter((t) => t.ready);
      this.visible = fallback.length ? fallback : nextVisible;
    } else {
      this.visible = nextVisible;
    }

    this.pending = this.inflight.size > 0 || nextVisible.some((t) => !t.ready);
  }

  getVisibleTiles(): readonly VisibleTile[] {
    return this.visible;
  }

  hasPending(): boolean {
    return this.pending;
  }

  clear(): void {
    this.generation += 1;
    for (const job of this.inflight.values()) job.cancel();
    this.inflight.clear();
    this.cache.clear();
    this.visible = [];
    this.manifest = null;
    this.currentLevelId = undefined;
    this.pending = false;
  }

  private collectTiles(level: TileLevel, preload: Rect, view: Rect): NeededTile[] {
    const manifest = this.manifest!;
    const tileWorld = manifest.tileSize / level.scale;
    const cols = Math.ceil((manifest.width * level.scale) / manifest.tileSize);
    const rows = Math.ceil((manifest.height * level.scale) / manifest.tileSize);
    const col0 = Math.max(0, Math.floor(preload.left / tileWorld));
    const row0 = Math.max(0, Math.floor(preload.top / tileWorld));
    const col1 = Math.min(cols - 1, Math.floor((preload.right - 1e-6) / tileWorld));
    const row1 = Math.min(rows - 1, Math.floor((preload.bottom - 1e-6) / tileWorld));
    const out: NeededTile[] = [];
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) {
        const worldX = col * tileWorld;
        const worldY = row * tileWorld;
        const worldWidth = Math.min(tileWorld, manifest.width - worldX);
        const worldHeight = Math.min(tileWorld, manifest.height - worldY);
        const key = `${level.id}:${col}:${row}`;
        const url = this.resolve(tileUrl(manifest, level.id, col, row));
        const tileRect = { left: worldX, top: worldY, right: worldX + worldWidth, bottom: worldY + worldHeight };
        const priority: Priority = rectsOverlap(tileRect, view) ? 0 : 2;
        out.push({
          key,
          level,
          col,
          row,
          worldX,
          worldY,
          worldWidth,
          worldHeight,
          url,
          priority,
        });
      }
    }
    return out;
  }

  private startLoad(tile: NeededTile): void {
    const gen = this.generation;
    let cancelled = false;
    this.inflight.set(tile.key, {
      cancel: () => {
        cancelled = true;
        this.assets.cancel(tile.url);
      },
    });
    void this.assets
      .loadImageBitmap(tile.url)
      .then((bitmap) => {
        if (cancelled || gen !== this.generation) {
          bitmap.close?.();
          return;
        }
        const bytes = bitmap.width * bitmap.height * 4;
        this.cache.set({ key: tile.key, bitmap, bytes }, tile.priority === 0);
        this.inflight.delete(tile.key);
        this.onWake();
      })
      .catch((err: unknown) => {
        this.inflight.delete(tile.key);
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn(`[handscroll] tile failed ${tile.url}`, err);
        this.onWake();
      });
  }

  private resolve(relative: string): string {
    if (relative.startsWith("/")) return relative;
    return `${this.baseUrl}${relative.replace(/^\.\//, "")}`;
  }

}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface AbortLike {
  cancel(): void;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function toRect(tile: NeededTile): Rect {
  return {
    left: tile.worldX,
    top: tile.worldY,
    right: tile.worldX + tile.worldWidth,
    bottom: tile.worldY + tile.worldHeight,
  };
}
