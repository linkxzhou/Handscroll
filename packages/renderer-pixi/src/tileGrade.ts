import type { ColorMatrixFilter, Container } from "pixi.js";
import type { TileGrade } from "@handscroll/core";

/** Enough of ColorMatrixFilter to paint a night grade without a GL context. */
export interface NightGradeFilter {
  reset(): void;
  brightness(amount: number, multiply?: boolean): void;
  tint(color: number, multiply?: boolean): void;
}

/**
 * Night grade for the tile layer.
 * darkness 1 is a cool multiply in the neighborhood of rgba(8, 12, 32, 0.5):
 * brightness drops and a blue tint is layered on. Coefficients are a starting point.
 */
export function paintNight(filter: NightGradeFilter, darkness: number): void {
  const d = Math.min(1, Math.max(0, darkness));
  filter.reset();
  filter.brightness(1 - d * 0.48, false);
  filter.tint(0x1a2744, true);
}

export function applyTileGrade(
  tiles: Container,
  actors: Container,
  grade: TileGrade,
  filters: { tiles: ColorMatrixFilter; actors: ColorMatrixFilter },
): void {
  const darkness = Math.min(1, Math.max(0, grade.darkness));
  if (darkness <= 0) {
    tiles.filters = null;
    actors.filters = null;
    return;
  }
  paintNight(filters.tiles, darkness);
  tiles.filters = [filters.tiles];
  if (grade.gradeActors) {
    paintNight(filters.actors, darkness);
    actors.filters = [filters.actors];
  } else {
    actors.filters = null;
  }
}
