import type { AabbItem, HitResult, HotspotEntity, SceneEntity } from "@handscroll/core";
import { SpatialIndex } from "./SpatialIndex.ts";

export function pointInHotspot(worldX: number, worldY: number, entity: HotspotEntity): boolean {
  const lx = worldX - entity.x;
  const ly = worldY - entity.y;
  const shape = entity.shape;
  if (shape.kind === "rect") {
    return lx >= 0 && ly >= 0 && lx <= shape.w && ly <= shape.h;
  }
  if (shape.kind === "circle") {
    return lx * lx + ly * ly <= shape.r * shape.r;
  }
  return pointInPolygon(worldX, worldY, shape.points.map((p) => ({ x: p.x + entity.x, y: p.y + entity.y })));
}

function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i]!;
    const pj = points[j]!;
    const intersect = pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y + 1e-12) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hotspotItems(entities: readonly SceneEntity[]): AabbItem[] {
  const items: AabbItem[] = [];
  entities.forEach((entity, order) => {
    if (entity.type !== "hotspot") return;
    items.push(hotspotAabb(entity, order));
  });
  return items;
}

export function resolveHits(
  found: readonly AabbItem[],
  entities: readonly SceneEntity[],
  worldX: number,
  worldY: number,
): HitResult[] {
  const hotspots = new Map<string, HotspotEntity>();
  for (const entity of entities) {
    if (entity.type === "hotspot") hotspots.set(entity.id, entity);
  }
  const hits: Array<HitResult & { order: number }> = [];
  const seen = new Set<string>();
  for (const item of found) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.kind === "actor") {
      hits.push({
        entityId: item.id,
        renderer: "pixi",
        interactionPriority: item.interactionPriority ?? 0,
        worldX,
        worldY,
        order: item.order ?? 0,
      });
      continue;
    }
    const hotspot = hotspots.get(item.id);
    if (!hotspot || !pointInHotspot(worldX, worldY, hotspot)) continue;
    hits.push({
      entityId: hotspot.id,
      renderer: "pixi",
      interactionPriority: hotspot.interactionPriority ?? hotspot.zIndex ?? 0,
      worldX,
      worldY,
      order: item.order ?? 0,
    });
  }
  hits.sort((a, b) => b.interactionPriority - a.interactionPriority || b.order - a.order);
  return hits.map(({ order: _order, ...hit }) => hit);
}

export function pick(
  worldX: number,
  worldY: number,
  entities: readonly SceneEntity[],
): HitResult | null {
  return pickAll(worldX, worldY, entities)[0] ?? null;
}

/** Hotspot picks go through the AABB index, then the exact shape test. */
export function pickAll(
  worldX: number,
  worldY: number,
  entities: readonly SceneEntity[],
): HitResult[] {
  const index = new SpatialIndex();
  index.loadStatic(hotspotItems(entities));
  return resolveHits(index.queryPoint(worldX, worldY), entities, worldX, worldY);
}

function hotspotAabb(entity: HotspotEntity, order: number): AabbItem {
  const priority = entity.interactionPriority ?? entity.zIndex ?? 0;
  const base = { id: entity.id, interactionPriority: priority, order, kind: "hotspot" as const };
  const shape = entity.shape;
  if (shape.kind === "rect") {
    return { ...base, minX: entity.x, minY: entity.y, maxX: entity.x + shape.w, maxY: entity.y + shape.h };
  }
  if (shape.kind === "circle") {
    return {
      ...base,
      minX: entity.x - shape.r,
      minY: entity.y - shape.r,
      maxX: entity.x + shape.r,
      maxY: entity.y + shape.r,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of shape.points) {
    minX = Math.min(minX, entity.x + point.x);
    minY = Math.min(minY, entity.y + point.y);
    maxX = Math.max(maxX, entity.x + point.x);
    maxY = Math.max(maxY, entity.y + point.y);
  }
  return { ...base, minX, minY, maxX, maxY };
}
