import type { AabbItem, AabbRect, SpatialQuery } from "@handscroll/core";

/** Selected in plan/v2 ADR 0003: uniform grid, 256 world pixels, no rbush/flatbush dependency. */
export const SPATIAL_CELL_SIZE = 256;

/**
 * Uniform grid of AABBs.
 * Static items (hotspots, zones) and dynamic items (moving actors) are stored apart
 * and rebuilt into the same cells whenever either set changes.
 */
export class SpatialIndex implements SpatialQuery {
  private staticItems: AabbItem[] = [];
  private dynamicItems: AabbItem[] = [];
  private readonly cells = new Map<string, AabbItem[]>();

  loadStatic(items: readonly AabbItem[]): void {
    this.staticItems = items.slice();
    this.rebuild();
  }

  loadDynamic(items: readonly AabbItem[]): void {
    this.dynamicItems = items.slice();
    this.rebuild();
  }

  queryPoint(x: number, y: number): AabbItem[] {
    const bucket = this.cells.get(cellKey(Math.floor(x / SPATIAL_CELL_SIZE), Math.floor(y / SPATIAL_CELL_SIZE)));
    if (!bucket) return [];
    const hits: AabbItem[] = [];
    for (const item of bucket) {
      if (x >= item.minX && y >= item.minY && x <= item.maxX && y <= item.maxY) hits.push(item);
    }
    return hits;
  }

  queryRect(rect: AabbRect): AabbItem[] {
    const [x0, x1] = cellSpan(rect.minX, rect.maxX);
    const [y0, y1] = cellSpan(rect.minY, rect.maxY);
    const seen = new Set<string>();
    const hits: AabbItem[] = [];
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (seen.has(item.id)) continue;
          if (!overlaps(item, rect)) continue;
          seen.add(item.id);
          hits.push(item);
        }
      }
    }
    return hits;
  }

  private rebuild(): void {
    this.cells.clear();
    for (const item of this.staticItems) this.insert(item);
    for (const item of this.dynamicItems) this.insert(item);
  }

  private insert(item: AabbItem): void {
    const [x0, x1] = cellSpan(item.minX, item.maxX);
    const [y0, y1] = cellSpan(item.minY, item.maxY);
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) {
        const key = cellKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(item);
      }
    }
  }
}

function cellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

function cellSpan(min: number, max: number): [number, number] {
  return [Math.floor(min / SPATIAL_CELL_SIZE), Math.floor(max / SPATIAL_CELL_SIZE)];
}

function overlaps(item: AabbItem, rect: AabbRect): boolean {
  return item.minX <= rect.maxX && item.maxX >= rect.minX && item.minY <= rect.maxY && item.maxY >= rect.minY;
}
