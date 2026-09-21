import { describe, expect, it } from "vitest";
import { ViewportController } from "@handscroll/core";

describe("ViewportController E-U-01..04", () => {
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

  it("pans by screen pixels in world units", () => {
    const vp = new ViewportController({
      centerX: 500,
      centerY: 250,
      zoom: 2,
      screenWidth: 400,
      screenHeight: 200,
    });
    vp.panByScreen(100, -40);
    const s = vp.getState();
    expect(s.centerX).toBe(450);
    expect(s.centerY).toBe(270);
  });

  it("flyTo with duration 0 jumps immediately", () => {
    const vp = new ViewportController({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      screenWidth: 800,
      screenHeight: 600,
    });
    vp.flyTo({ centerX: 300, centerY: 120, zoom: 2, duration: 0 });
    expect(vp.isAnimating()).toBe(false);
    const s = vp.getState();
    expect(s.centerX).toBe(300);
    expect(s.centerY).toBe(120);
    expect(s.zoom).toBe(2);
  });

  it("interrupts an in-flight flyTo (E-U-04)", () => {
    const vp = new ViewportController({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      screenWidth: 800,
      screenHeight: 600,
    });
    vp.flyTo({ centerX: 800, centerY: 400, zoom: 2, duration: 1000 });
    expect(vp.isAnimating()).toBe(true);
    vp.update(0.1);
    const mid = vp.getState();
    expect(mid.centerX).toBeGreaterThan(0);
    expect(mid.centerX).toBeLessThan(800);
    vp.interruptTransition();
    expect(vp.isAnimating()).toBe(false);
    vp.update(0.5);
    const after = vp.getState();
    expect(after.centerX).toBe(mid.centerX);
    expect(after.zoom).toBe(mid.zoom);
  });

  it("completes flyTo after enough update time", () => {
    const vp = new ViewportController({
      centerX: 10,
      centerY: 10,
      zoom: 1,
      screenWidth: 400,
      screenHeight: 400,
    });
    vp.flyTo({ centerX: 100, centerY: 80, zoom: 1.5, duration: 200 });
    vp.update(0.25);
    expect(vp.isAnimating()).toBe(false);
    const s = vp.getState();
    expect(s.centerX).toBe(100);
    expect(s.centerY).toBe(80);
    expect(s.zoom).toBe(1.5);
  });

  it("does not zoom past maxZoom", () => {
    const vp = new ViewportController({
      centerX: 100,
      centerY: 100,
      zoom: 8,
      screenWidth: 400,
      screenHeight: 400,
    });
    vp.setLimits({ maxZoom: 8 });
    const before = vp.getState();
    vp.zoomAtScreen(2, 200, 200);
    expect(vp.getState().zoom).toBe(before.zoom);
  });

  it("decays inertia until it stops", () => {
    const vp = new ViewportController({
      centerX: 500,
      centerY: 250,
      zoom: 1,
      screenWidth: 200,
      screenHeight: 200,
    });
    vp.setVelocity(400, 0);
    expect(vp.isAnimating()).toBe(true);
    const start = vp.getState().centerX;
    vp.update(0.016);
    expect(vp.getState().centerX).not.toBe(start);
    for (let i = 0; i < 80; i++) vp.update(0.05);
    expect(vp.isAnimating()).toBe(false);
  });

  it("reports the visible world rect", () => {
    const vp = new ViewportController({
      centerX: 100,
      centerY: 50,
      zoom: 2,
      screenWidth: 200,
      screenHeight: 100,
    });
    const rect = vp.visibleWorldRect(0);
    expect(rect.left).toBe(50);
    expect(rect.right).toBe(150);
    expect(rect.top).toBe(25);
    expect(rect.bottom).toBe(75);
  });
});
