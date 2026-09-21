/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { ScrollEngine, type RendererAdapter, type VisibleTile } from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { builtinPlugins } from "@handscroll/plugins";

function stubRenderer(kind: "pixi" | "three"): RendererAdapter & { tiles: VisibleTile[] } {
  const seen: VisibleTile[] = [];
  return {
    kind,
    tiles: seen,
    async mount(container) {
      const canvas = document.createElement("canvas");
      canvas.className = kind === "pixi" ? "pixi-layer" : "three-layer";
      container.appendChild(canvas);
      return canvas;
    },
    setSize() {},
    sync() {},
    setTiles(tiles) {
      seen.splice(0, seen.length, ...tiles);
    },
    render() {},
    destroy() {},
    needsThree: () => false,
  };
}

afterEach(async () => {
  document.body.replaceChildren();
});

describe("ScrollEngine loadContent (stub renderers)", () => {
  it("loads meta/plugins/tiles, pans, and destroys without throwing", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { get: () => 200 });
    Object.defineProperty(container, "clientHeight", { get: () => 200 });
    document.body.appendChild(container);

    const pixi = stubRenderer("pixi");
    const three = stubRenderer("three");
    const assets = new AssetManager();
    const tiles = new TileManager(assets, () => {});
    const engine = await ScrollEngine.create(
      {
        container,
        renderers: { pixi: true, three: "lazy" },
        contentResolver: {
          async loadMeta() {
            return {
              id: "demo-scroll",
              title: "Demo",
              width: 2048,
              height: 512,
              plugins: ["quality", "guide"],
              defaultViewport: { centerX: 256, centerY: 256, zoom: 1 },
            };
          },
          async loadManifest() {
            return {
              width: 2048,
              height: 512,
              tileSize: 512,
              levels: [{ id: "0", scale: 1 }],
              tileUrl: "{level}/{x}_{y}.webp",
            };
          },
          async loadScene() {
            return {
              version: 1 as const,
              meta: { id: "demo-scroll", width: 2048, height: 512 },
              background: { manifestUrl: "./tiles/manifest.json" },
              entities: [],
              chapters: [{ id: "bridge", title: "Bridge", centerX: 1500, centerY: 256, zoom: 0.8 }],
            };
          },
          resolveUrl(_id, rel) {
            return `/contents/demo-scroll/${rel.replace(/^\//, "")}`;
          },
        },
        adapters: {
          createPixi: () => pixi,
          createThree: () => three,
        },
        pluginRegistry: builtinPlugins,
      },
      {
        assets,
        tiles,
        interaction: new InteractionManager(),
        animation: new AnimationRuntime(),
      },
    );

    await engine.loadContent("demo-scroll");
    expect(engine.getScrollId()).toBe("demo-scroll");
    expect(engine.getViewport().centerX).toBe(256);
    expect(container.querySelector(".pixi-layer")).toBeTruthy();
    expect(container.querySelector(".three-layer")).toBeTruthy();
    expect(container.querySelector(".guide-rail")).toBeTruthy();
    expect(container.querySelector(".guide-rail__dot")?.textContent).toBe("Bridge");

    const before = engine.getViewport().centerX;
    engine.camera.panByScreen(-200, 0);
    expect(engine.getViewport().centerX).toBeGreaterThan(before);

    await engine.destroy();
    expect(engine.scheduler.isRunning()).toBe(false);
    expect(container.childElementCount).toBe(0);
  });
});
