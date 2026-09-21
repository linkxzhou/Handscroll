import type { HitResult, SceneEntity, HotspotEntity } from "@handscroll/core";

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

export function pick(
  worldX: number,
  worldY: number,
  entities: readonly SceneEntity[],
): HitResult | null {
  return pickAll(worldX, worldY, entities)[0] ?? null;
}

export function pickAll(
  worldX: number,
  worldY: number,
  entities: readonly SceneEntity[],
): HitResult[] {
  const hits: HitResult[] = [];
  for (const entity of entities) {
    if (entity.type !== "hotspot") continue;
    if (!pointInHotspot(worldX, worldY, entity)) continue;
    hits.push({
      entityId: entity.id,
      renderer: "pixi",
      interactionPriority: entity.interactionPriority ?? entity.zIndex ?? 0,
      worldX,
      worldY,
    });
  }
  hits.sort((a, b) => b.interactionPriority - a.interactionPriority);
  return hits;
}
