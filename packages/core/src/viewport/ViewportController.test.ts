import { describe, expect, it } from "vitest";
import { ViewportController } from "@handscroll/core";

describe("ViewportController E-U-01..03", () => {
  it("round-trips screen ↔ world (E-U-01)", () => {
    const vp = new ViewportController({
      centerX: 400,
      centerY: 250,
      zoom: 1.75,
      screenWidth: 1280,
      screenHeight: 720,
    });
    const world = vp.screenToWorld(320.5, 180.25);
    const screen = vp.worldToScreen(world.x, world.y);
    expect(Math.abs(screen.x - 320.5)).toBeLessThan(1e-6);
    expect(Math.abs(screen.y - 180.25)).toBeLessThan(1e-6);
  });

  it("keeps the world point under the cursor after zoomAtScreen (E-U-02)", () => {
    const vp = new ViewportController({
      centerX: 1000,
      centerY: 400,
      zoom: 1,
      screenWidth: 800,
      screenHeight: 600,
    });
    const sx = 220;
    const sy = 140;
    const before = vp.screenToWorld(sx, sy);
    vp.zoomAtScreen(1.35, sx, sy);
    const after = vp.screenToWorld(sx, sy);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1e-6);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1e-6);
  });

  it("clamps center inside the scene (E-U-03)", () => {
    const vp = new ViewportController({
      centerX: -9999,
      centerY: 9999,
      zoom: 2,
      screenWidth: 400,
      screenHeight: 200,
    });
    vp.clampToScene({ id: "demo", width: 1000, height: 500 });
    const s = vp.getState();
    expect(s.centerX).toBe(100);
    expect(s.centerY).toBe(450);
  });

  it("centers when the scene is smaller than the view", () => {
    const vp = new ViewportController({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      screenWidth: 2000,
      screenHeight: 1000,
    });
    vp.clampToScene({ id: "tiny", width: 100, height: 50 });
    const s = vp.getState();
    expect(s.centerX).toBe(50);
    expect(s.centerY).toBe(25);
  });
});
