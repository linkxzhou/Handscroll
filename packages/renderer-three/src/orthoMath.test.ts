import { describe, expect, it } from "vitest";
import { ViewportController } from "@handscroll/core";
import { orthoCameraFromViewport } from "./orthoMath.ts";

describe("Three ortho pose", () => {
  it("uses a Y-down painting mapped to Y-up with matching visible size", () => {
    const vp = new ViewportController({
      centerX: 2304,
      centerY: 512,
      zoom: 0.8,
      screenWidth: 1280,
      screenHeight: 800,
    });
    const pose = orthoCameraFromViewport(vp.getState());
    const visW = 1280 / 0.8;
    const visH = 800 / 0.8;
    expect(pose.left).toBeCloseTo(-visW / 2);
    expect(pose.right).toBeCloseTo(visW / 2);
    expect(pose.top).toBeCloseTo(visH / 2);
    expect(pose.bottom).toBeCloseTo(-visH / 2);
    expect(pose.position.x).toBe(2304);
    expect(pose.position.y).toBe(-512);
    expect(pose.lookAt.y).toBe(-512);
  });
});
