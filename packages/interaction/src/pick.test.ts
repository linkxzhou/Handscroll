import { describe, expect, it } from "vitest";
import { pick } from "./pick.ts";
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
});
