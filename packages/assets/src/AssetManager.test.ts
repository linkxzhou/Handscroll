import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetManager } from "./AssetManager.ts";

describe("AssetManager E-U-10", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("coalesces concurrent loads of the same URL", async () => {
    let fetches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        fetches += 1;
        return {
          ok: true,
          blob: async () => new Blob([new Uint8Array([1, 2, 3])]),
        };
      }),
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1, height: 1, close() {} })),
    );

    const assets = new AssetManager();
    const a = assets.loadImageBitmap("/tiles/0/0_0.webp");
    const b = assets.loadImageBitmap("/tiles/0/0_0.webp");
    expect(a).toBe(b);
    await a;
    expect(fetches).toBe(1);
  });
});
