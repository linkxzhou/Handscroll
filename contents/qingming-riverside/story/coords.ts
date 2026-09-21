/** Reference runtime origin sits on the center panel; engine world is the 6516-wide stitch. */
export const REF_SHIFT_X = 2172;
export const WORLD_WIDTH = 6516;
export const WORLD_HEIGHT = 724;

export interface WorldPoint {
  x: number;
  y: number;
}

export function fromRef(xRef: number, yRef: number): WorldPoint {
  return { x: xRef + REF_SHIFT_X, y: yRef };
}

export function toRef(x: number, y: number): WorldPoint {
  return { x: x - REF_SHIFT_X, y };
}

export function inWorld(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;
}

/** Upstream `world.berths` after +2172. */
export const BERTHS = {
  west: fromRef(630, 556),
  east: fromRef(2085, 556),
} as const;

/** Upstream waiting waterline, used only as a fallback spawn. */
export const FERRY_WAIT = fromRef(1880, 576);

/** Featured-characters boat metrics × ferryGeometry.scale (1.24). */
export const BOAT_SPRITE = {
  url: "./atlas/boat.webp",
  width: 172 * 1.24,
  height: 52 * 1.24,
  anchorX: 86 * 1.24,
  anchorY: 43 * 1.24,
} as const;

/** Upstream `#district-stops` data-x values, remapped and vertically framed on the stitch. */
export const CHAPTERS = {
  watermill: { centerX: fromRef(-1550, 0).x, centerY: 400, zoom: 1.15 },
  teahouse: { centerX: fromRef(650, 0).x, centerY: 400, zoom: 1.2 },
  bridge: { centerX: fromRef(1560, 0).x, centerY: 400, zoom: 1.25 },
  gate: { centerX: fromRef(3360, 0).x, centerY: 400, zoom: 1.1 },
} as const;

export function worldToScreen(
  viewport: { centerX: number; centerY: number; zoom: number; screenWidth: number; screenHeight: number },
  x: number,
  y: number,
): WorldPoint {
  return {
    x: (x - viewport.centerX) * viewport.zoom + viewport.screenWidth / 2,
    y: (y - viewport.centerY) * viewport.zoom + viewport.screenHeight / 2,
  };
}
