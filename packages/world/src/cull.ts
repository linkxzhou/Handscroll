import type { ViewportState } from "@handscroll/core";

/** Default margin in world pixels. Packs may override it. */
export const DEFAULT_ACTIVE_MARGIN = 320;

export type CullState = "active" | "frozen" | "hidden";

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function viewportRect(viewport: ViewportState, margin: number): WorldRect {
  const halfW = viewport.screenWidth / (2 * viewport.zoom);
  const halfH = viewport.screenHeight / (2 * viewport.zoom);
  return {
    minX: viewport.centerX - halfW - margin,
    minY: viewport.centerY - halfH - margin,
    maxX: viewport.centerX + halfW + margin,
    maxY: viewport.centerY + halfH + margin,
  };
}

export function intersects(a: WorldRect, b: WorldRect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * active: overlaps the viewport expanded by `margin` — simulate and draw.
 * frozen: outside active, still inside `margin * 2` — draw the last frame.
 * hidden: outside the frozen rect — neither.
 * `cull === false` stays active.
 */
export function cullStateFor(actor: WorldRect, active: WorldRect, frozen: WorldRect, cull: boolean): CullState {
  if (!cull) return "active";
  if (intersects(actor, active)) return "active";
  if (intersects(actor, frozen)) return "frozen";
  return "hidden";
}
