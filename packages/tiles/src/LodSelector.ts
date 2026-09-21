import type { TileLevel } from "./parseManifest.ts";

export interface LodSelection {
  level: TileLevel;
  targetScale: number;
}

/**
 * Pick the coarsest level whose scale is still >= zoom * dpr (display scale).
 * Hysteresis keeps the current level unless the target crosses a margin.
 */
export function selectLod(
  levels: readonly TileLevel[],
  zoom: number,
  dpr: number,
  currentId?: string,
  hysteresis = 0.12,
): LodSelection {
  if (levels.length === 0) {
    throw new Error("No LOD levels");
  }
  const targetScale = Math.max(zoom * dpr, 0.0001);
  const sorted = [...levels].sort((a, b) => a.scale - b.scale);

  let ideal = sorted[sorted.length - 1]!;
  for (const level of sorted) {
    if (level.scale + 1e-9 >= targetScale) {
      ideal = level;
      break;
    }
  }

  const current = currentId ? sorted.find((l) => l.id === currentId) : undefined;
  if (!current || current.id === ideal.id) {
    return { level: ideal, targetScale };
  }

  if (ideal.scale > current.scale) {
    // Need sharper tiles: wait until target is clearly above current.
    if (targetScale > current.scale * (1 + hysteresis)) {
      return { level: ideal, targetScale };
    }
    return { level: current, targetScale };
  }

  // Going coarser: wait until target is clearly below current.
  if (targetScale < current.scale * (1 - hysteresis)) {
    return { level: ideal, targetScale };
  }
  return { level: current, targetScale };
}
