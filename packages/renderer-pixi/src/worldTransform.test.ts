import { describe, expect, it } from "vitest";
import { ViewportController } from "@handscroll/core";
import { applyWorldRoot, worldRootTransform } from "./worldTransform.ts";

describe("Pixi world-root transform", () => {
  it("projects a world point to the same screen point as ViewportController", () => {
    const vp = new ViewportController({
      centerX: 640,
      centerY: 200,
      zoom: 0.55,
      screenWidth: 1280,
      screenHeight: 720,
    });
    const pose = worldRootTransform(vp.getState());
    expect(pose.scale).toBe(0.55);
    const world = { x: 2304, y: 512 };
    const viaPixi = applyWorldRoot(world, pose);
    const viaCamera = vp.worldToScreen(world.x, world.y);
    expect(viaPixi.x).toBeCloseTo(viaCamera.x, 8);
    expect(viaPixi.y).toBeCloseTo(viaCamera.y, 8);
  });

  it("keeps the screen mapping after zoom-about-point", () => {
    const vp = new ViewportController({
      centerX: 400,
      centerY: 300,
      zoom: 1,
      screenWidth: 800,
      screenHeight: 600,
    });
    vp.zoomAtScreen(1.8, 120, 90);
    const pose = worldRootTransform(vp.getState());
    const world = vp.screenToWorld(120, 90);
    const back = applyWorldRoot(world, pose);
    expect(back.x).toBeCloseTo(120, 8);
    expect(back.y).toBeCloseTo(90, 8);
  });
});
