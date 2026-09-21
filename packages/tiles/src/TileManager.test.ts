import { describe, expect, it, vi } from "vitest";
import { TileManager } from "./TileManager.ts";
import type { AssetManager } from "@handscroll/assets";

describe("TileManager", () => {
  it("lists visible tiles for the current viewport and drops stale inflight keys", async () => {
    const cancel = vi.fn();
    const assets = {
      loadImageBitmap: vi.fn(() => new Promise<ImageBitmap>(() => {})),
      cancel,
      cancelAll: vi.fn(),
      pendingCount: () => 1,
    } as unknown as AssetManager;

    const mgr = new TileManager(assets, () => {});
    await mgr.load(
      {
        width: 1024,
        height: 512,
        tileSize: 512,
        levels: [{ id: "0", scale: 1 }],
        tileUrl: "{level}/{x}_{y}.webp",
      },
      "/contents/demo-scroll/tiles/",
    );

    mgr.update(
      { centerX: 256, centerY: 256, zoom: 1, screenWidth: 256, screenHeight: 256 },
      { gpuBudgetBytes: 1e9, decodedBudgetBytes: 1e9, maxConcurrentRequests: 2, maxUploadsPerFrame: 4 },
      1,
    );
    const first = mgr.getVisibleTiles();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((t) => t.levelId === "0")).toBe(true);
    expect(mgr.hasPending()).toBe(true);

    mgr.update(
      { centerX: 900, centerY: 256, zoom: 1, screenWidth: 256, screenHeight: 256 },
      { gpuBudgetBytes: 1e9, decodedBudgetBytes: 1e9, maxConcurrentRequests: 2, maxUploadsPerFrame: 4 },
      1,
    );
    expect(cancel).toHaveBeenCalled();
  });
});
