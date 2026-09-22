/** Axis-aligned item stored in the spatial index. Core does not pick a library. */
export interface AabbItem {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  interactionPriority?: number;
  /** Declaration order. Larger values win ties. */
  order?: number;
  kind?: "hotspot" | "actor" | "zone";
}

export interface AabbRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialQuery {
  loadStatic(items: readonly AabbItem[]): void;
  loadDynamic(items: readonly AabbItem[]): void;
  queryPoint(x: number, y: number): AabbItem[];
  queryRect(rect: AabbRect): AabbItem[];
}
