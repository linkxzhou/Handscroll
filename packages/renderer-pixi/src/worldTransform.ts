import type { ViewportState } from "@handscroll/core";

export interface WorldRootTransform {
  scale: number;
  x: number;
  y: number;
}

/** Pixi world-root pose. Matches ViewportController.worldToScreen. */
export function worldRootTransform(viewport: ViewportState): WorldRootTransform {
  return {
    scale: viewport.zoom,
    x: viewport.screenWidth / 2 - viewport.centerX * viewport.zoom,
    y: viewport.screenHeight / 2 - viewport.centerY * viewport.zoom,
  };
}

export function applyWorldRoot(world: { x: number; y: number }, transform: WorldRootTransform): { x: number; y: number } {
  return {
    x: world.x * transform.scale + transform.x,
    y: world.y * transform.scale + transform.y,
  };
}
