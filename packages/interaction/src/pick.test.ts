import { describe, expect, it } from "vitest";
import { pick } from "./pick.ts";
import { InteractionManager } from "./InteractionManager.ts";
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

  it("lets the later declaration win equal interactionPriority (W-U-06)", () => {
    const entities: SceneEntity[] = [
      { id: "first", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 10, h: 10 }, interactionPriority: 3 },
      { id: "second", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 10, h: 10 }, interactionPriority: 3 },
    ];
    expect(pick(2, 2, entities)?.entityId).toBe("second");
  });

  it("rejects a point that sits in the polygon bbox but outside the polygon", () => {
    const entities: SceneEntity[] = [
      {
        id: "tri",
        type: "hotspot",
        x: 0,
        y: 0,
        shape: {
          kind: "polygon",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
          ],
        },
      },
    ];
    expect(pick(9, 9, entities)).toBeNull();
    expect(pick(1, 1, entities)?.entityId).toBe("tri");
  });
});

describe("actor hits W-U-06", () => {
  it("orders overlapping actors by interactionPriority, then later declaration", () => {
    const manager = new InteractionManager();
    manager.sync([
      { id: "low", minX: 0, minY: 0, maxX: 10, maxY: 10, kind: "actor", interactionPriority: 1, order: 0 },
      { id: "high", minX: 0, minY: 0, maxX: 10, maxY: 10, kind: "actor", interactionPriority: 4, order: 1 },
      { id: "tie-early", minX: 0, minY: 0, maxX: 10, maxY: 10, kind: "actor", interactionPriority: 4, order: 2 },
      { id: "tie-late", minX: 0, minY: 0, maxX: 10, maxY: 10, kind: "actor", interactionPriority: 4, order: 3 },
    ]);
    expect(manager.pickAll(3, 3).map((hit) => hit.entityId)).toEqual(["tie-late", "tie-early", "high", "low"]);
    expect(manager.pick(3, 3)?.renderer).toBe("pixi");
  });
});
