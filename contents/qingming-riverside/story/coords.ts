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

/**
 * Upstream `bridge-event.js` vessel stations after +2172.
 * Occluder is a DOM strip over the arch (faked occlusion — tiles stay a single layer).
 */
export const BRIDGE_PATH = {
  approach: fromRef(1790, 662),
  mastStart: fromRef(1635, 596),
  mastEnd: fromRef(1530, 550),
  underEnd: fromRef(1510, 485),
} as const;

export const BRIDGE_APEX = fromRef(1501.7, 402.4);

export const BRIDGE_OCCLUDER = {
  x: fromRef(1428, 360).x,
  y: 360,
  w: 1595 - 1428,
  h: 90,
} as const;

export const BRIDGE_CARGO_SCALE = {
  approach: 1.17,
  mast: 1.05,
  under: 0.42,
} as const;

/** Lower river strip on the stitch — pluginConfig.water.bands uses this AABB. */
export const WATER_BAND = { x: 0, y: 520, w: WORLD_WIDTH, h: WORLD_HEIGHT - 520 } as const;

/** Street-level polylines (upstream pavement ≈ y=477) after +2172. */
export const STREET_PATHS = {
  teahouse: [fromRef(420, 492), fromRef(650, 477), fromRef(920, 484)],
  bridge: [fromRef(1380, 452), fromRef(1502, 414), fromRef(1680, 450)],
  gate: [fromRef(3180, 502), fromRef(3360, 477), fromRef(3560, 492)],
} as const;

export const SHOPS = {
  teahouse: fromRef(650, 444),
  bridgeStall: fromRef(1460, 458),
  gateStall: fromRef(3320, 498),
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

export function polylineLength(points: readonly WorldPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

export function pointAlong(points: readonly WorldPoint[], distance: number): WorldPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y };
}

export function inActiveZone(
  x: number,
  y: number,
  viewport: { centerX: number; centerY: number; zoom: number; screenWidth: number; screenHeight: number },
  margin = 320,
): boolean {
  const halfW = viewport.screenWidth / (2 * viewport.zoom) + margin;
  const halfH = viewport.screenHeight / (2 * viewport.zoom) + margin;
  return Math.abs(x - viewport.centerX) <= halfW && Math.abs(y - viewport.centerY) <= halfH;
}
