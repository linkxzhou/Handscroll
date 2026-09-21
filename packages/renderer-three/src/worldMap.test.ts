import { describe, expect, it } from "vitest";
import { model3dAnchorsFromEntities } from "./anchors.ts";
import { DEFAULT_ANCHOR_Z, paintingToThree } from "./worldMap.ts";

describe("painting → Three mapping", () => {
  it("flips Y so (x, y) becomes (x, -y, z)", () => {
    expect(paintingToThree(2304, 512, 40)).toEqual({ x: 2304, y: -512, z: 40 });
  });

  it("places model3d anchors on the painting plane with a raised z", () => {
    const anchors = model3dAnchorsFromEntities([
      { id: "ignore", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 1, h: 1 } },
      { id: "anchor-box", type: "model3d", x: 2304, y: 512, url: "primitive:box" },
    ]);
    expect(anchors).toEqual([{ id: "anchor-box", x: 2304, y: -512, z: DEFAULT_ANCHOR_Z }]);
  });

  it("returns no anchors for a 2D-only entity list", () => {
    expect(model3dAnchorsFromEntities([{ id: "h", type: "hotspot", x: 1, y: 1, shape: { kind: "circle", r: 4 } }])).toEqual(
      [],
    );
  });
});
