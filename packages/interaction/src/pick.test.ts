import { describe, expect, it } from "vitest";
import { pick, pickAll, pointInHotspot } from "./pick.ts";
import type { SceneEntity } from "@handscroll/core";

describe("pick E-U-11", () => {
  it("returns the higher-priority overlapping hotspot", () => {
    const entities: SceneEntity[] = [
      { id: "low", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 10, h: 10 }, interactionPriority: 1 },
      { id: "high", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 10, h: 10 }, interactionPriority: 5 },
    ];
    const hit = pick(2, 2, entities);
    expect(hit?.entityId).toBe("high");
  });

  it("misses points outside a rect", () => {
    const entities: SceneEntity[] = [
      { id: "r", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 10, h: 10 } },
    ];
    expect(pick(50, 50, entities)).toBeNull();
  });

  it("hits a circle and a polygon", () => {
    const circle: SceneEntity = { id: "c", type: "hotspot", x: 10, y: 10, shape: { kind: "circle", r: 5 } };
    expect(pointInHotspot(12, 12, circle)).toBe(true);
    expect(pointInHotspot(20, 10, circle)).toBe(false);

    const poly: SceneEntity = {
      id: "p",
      type: "hotspot",
      x: 0,
      y: 0,
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    };
    expect(pointInHotspot(4, 4, poly)).toBe(true);
    expect(pointInHotspot(20, 4, poly)).toBe(false);
    expect(pickAll(4, 4, [poly, { id: "sprite", type: "sprite", x: 0, y: 0, url: "x.png" }]).map((h) => h.entityId)).toEqual([
      "p",
    ]);
  });
});
