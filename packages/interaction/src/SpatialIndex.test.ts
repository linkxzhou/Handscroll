import { describe, expect, it } from "vitest";
import { SPATIAL_CELL_SIZE, SpatialIndex } from "./SpatialIndex.ts";

describe("SpatialIndex", () => {
  it("returns only AABBs that contain the point, across cell boundaries", () => {
    const index = new SpatialIndex();
    const far = { id: "far", minX: 5000, minY: 5000, maxX: 5100, maxY: 5100 };
    const near = { id: "near", minX: -10, minY: -10, maxX: 30, maxY: 30 };
    const spanning = {
      id: "span",
      minX: SPATIAL_CELL_SIZE - 5,
      minY: 0,
      maxX: SPATIAL_CELL_SIZE + 20,
      maxY: 10,
    };
    index.loadStatic([far, near, spanning]);

    expect(index.queryPoint(0, 0).map((item) => item.id)).toEqual(["near"]);
    expect(index.queryPoint(SPATIAL_CELL_SIZE + 1, 1).map((item) => item.id)).toEqual(["span"]);
    expect(index.queryPoint(4000, 0)).toEqual([]);
    const rect = index.queryRect({ minX: 0, minY: 0, maxX: SPATIAL_CELL_SIZE + 5, maxY: 40 });
    expect(rect.map((item) => item.id).sort()).toEqual(["near", "span"]);
  });

  it("replaces dynamic items without dropping static ones", () => {
    const index = new SpatialIndex();
    index.loadStatic([{ id: "hot", minX: 0, minY: 0, maxX: 10, maxY: 10 }]);
    index.loadDynamic([{ id: "actor", minX: 1, minY: 1, maxX: 4, maxY: 4 }]);
    expect(index.queryPoint(2, 2).map((item) => item.id).sort()).toEqual(["actor", "hot"]);
    index.loadDynamic([]);
    expect(index.queryPoint(2, 2).map((item) => item.id)).toEqual(["hot"]);
  });
});
