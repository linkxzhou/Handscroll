import type { ZoneDef } from "../contracts/world.ts";

export function pointInZone(x: number, y: number, zone: ZoneDef): boolean {
  const lx = x - zone.x;
  const ly = y - zone.y;
  const shape = zone.shape;
  if (shape.kind === "rect") {
    return lx >= 0 && ly >= 0 && lx <= shape.w && ly <= shape.h;
  }
  if (shape.kind === "circle") {
    return lx * lx + ly * ly <= shape.r * shape.r;
  }
  return pointInPolygon(
    x,
    y,
    shape.points.map((p) => ({ x: p.x + zone.x, y: p.y + zone.y })),
  );
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
