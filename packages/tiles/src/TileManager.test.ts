import { describe, expect, it, vi } from "vitest";
import { ViewportController } from "@handscroll/core";
import { TileManager } from "./TileManager.ts";
import type { AssetManager } from "@handscroll/assets";

const POLICY = {
  gpuBudgetBytes: 1e9,
  decodedBudgetBytes: 1e9,
  maxConcurrentRequests: 4,
  maxUploadsPerFrame: 8,
};

function fakeAssets() {
  const cancel = vi.fn();
  const assets = {
    loadImageBitmap: vi.fn(() => new Promise<ImageBitmap>(() => {})),
    cancel,
    cancelAll: vi.fn(),
    pendingCount: () => 1,
  } as unknown as AssetManager;
  return { assets, cancel };
}

const MANIFEST = {
  width: 2048,
  height: 512,
  tileSize: 512,
  levels: [
    { id: "0", scale: 0.25 },
    { id: "1", scale: 0.5 },
    { id: "2", scale: 1 },
  ],
  tileUrl: "{level}/{x}_{y}.webp",
};

describe("TileManager", () => {
  it("lists visible tiles for the current viewport and drops stale inflight keys", async () => {
    const { assets, cancel } = fakeAssets();
    const mgr = new TileManager(assets, () => {});
    await mgr.load(MANIFEST, "/contents/demo-scroll/tiles/");

    mgr.update(
      { centerX: 256, centerY: 256, zoom: 1, screenWidth: 256, screenHeight: 256 },
      POLICY,
      1,
    );
    const first = mgr.getVisibleTiles();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((t) => t.levelId === "2")).toBe(true);
    expect(mgr.hasPending()).toBe(true);

    mgr.update(
      { centerX: 1800, centerY: 256, zoom: 1, screenWidth: 256, screenHeight: 256 },
      POLICY,
      1,
    );
    expect(cancel).toHaveBeenCalled();
  });

  it("pan/zoom smoke: visible set and LOD follow the camera", async () => {
    const { assets } = fakeAssets();
    const mgr = new TileManager(assets, () => {});
    await mgr.load(MANIFEST, "/tiles/");
    const vp = new ViewportController({
      centerX: 256,
      centerY: 256,
      zoom: 1,
      screenWidth: 256,
      screenHeight: 256,
    });

    mgr.update(vp.getState(), POLICY, 1);
    const startKeys = mgr.getVisibleTiles().map((t) => t.key).sort();
    expect(startKeys.length).toBeGreaterThan(0);
    expect(mgr.getVisibleTiles().every((t) => t.levelId === "2")).toBe(true);

    vp.panByScreen(-900, 0);
    mgr.update(vp.getState(), POLICY, 1);
    const pannedKeys = mgr.getVisibleTiles().map((t) => t.key).sort();
    expect(pannedKeys).not.toEqual(startKeys);

    vp.zoomAtScreen(0.25, 128, 128);
    mgr.update(vp.getState(), POLICY, 1);
    const zoomed = mgr.getVisibleTiles();
    expect(zoomed.length).toBeGreaterThan(0);
    expect(zoomed.every((t) => t.levelId !== "2")).toBe(true);
  });

  it("has no visible tiles before a manifest is loaded", () => {
    const { assets } = fakeAssets();
    const mgr = new TileManager(assets, () => {});
    mgr.update(
      { centerX: 0, centerY: 0, zoom: 1, screenWidth: 100, screenHeight: 100 },
      POLICY,
      1,
    );
    expect(mgr.getVisibleTiles()).toEqual([]);
    expect(mgr.hasPending()).toBe(false);
  });

  it("clear empties the visible set", async () => {
    const { assets } = fakeAssets();
    const mgr = new TileManager(assets, () => {});
    await mgr.load(MANIFEST, "/tiles/");
    mgr.update(
      { centerX: 256, centerY: 256, zoom: 1, screenWidth: 256, screenHeight: 256 },
      POLICY,
      1,
    );
    mgr.clear();
    expect(mgr.getVisibleTiles()).toEqual([]);
    expect(mgr.getManifest()).toBeNull();
  });
});
