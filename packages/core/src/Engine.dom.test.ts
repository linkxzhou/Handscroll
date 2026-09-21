/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  ScrollEngine,
  type ContentMeta,
  type ContentResolver,
  type RendererAdapter,
  type SceneDocument,
  type SceneEntity,
  type VisibleTile,
} from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { builtinPlugins } from "@handscroll/plugins";
import { registerStory as registerDemoStory } from "../../../contents/demo-scroll/story/index.ts";
import { registerStory as registerGuideStory } from "../../../contents/guide-only-scroll/story/index.ts";

interface ThreeStub extends RendererAdapter {
  tiles: VisibleTile[];
  loaded: number;
  entities: SceneEntity[];
}

function stubRenderer(kind: "pixi" | "three"): ThreeStub {
  const seen: VisibleTile[] = [];
  const entities: SceneEntity[] = [];
  const stub: ThreeStub = {
    kind,
    tiles: seen,
    loaded: 0,
    entities,
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
    setSceneEntities(next) {
      entities.splice(0, entities.length, ...next);
    },
    render() {},
    destroy() {},
    needsThree: () => stub.loaded > 0,
    ensureLoaded: async () => {
      stub.loaded += 1;
    },
  };
  return stub;
}

function meta(id: string, extra: Partial<ContentMeta> = {}): ContentMeta {
  return {
    id,
    title: id,
    width: extra.width ?? 2048,
    height: extra.height ?? 512,
    plugins: extra.plugins ?? ["quality", "guide"],
    defaultViewport: extra.defaultViewport ?? { centerX: 256, centerY: 256, zoom: 1 },
    storyEntry: extra.storyEntry ?? "./story/index.ts",
    pluginConfig: extra.pluginConfig,
  };
}

function scene(id: string, extra: Partial<SceneDocument> = {}): SceneDocument {
  return {
    version: 1,
    meta: { id, width: extra.meta?.width ?? 2048, height: extra.meta?.height ?? 512 },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: extra.entities ?? [],
    chapters: extra.chapters ?? [{ id: "bridge", title: "Bridge", centerX: 1500, centerY: 256, zoom: 0.8 }],
  };
}

function resolverFor(
  packs: Record<
    string,
    {
      meta: ContentMeta;
      scene: SceneDocument;
      loadStory?: ContentResolver["loadStory"];
    }
  >,
): ContentResolver {
  return {
    async loadMeta(id) {
      return packs[id]!.meta;
    },
    async loadManifest(id) {
      const pack = packs[id]!;
      return {
        width: pack.meta.width,
        height: pack.meta.height,
        tileSize: 512,
        levels: [{ id: "0", scale: 1 }],
        tileUrl: "{level}/{x}_{y}.webp",
      };
    },
    async loadScene(id) {
      return packs[id]!.scene;
    },
    resolveUrl(id, rel) {
      return `/contents/${id}/${rel.replace(/^\//, "")}`;
    },
    async loadStory(id, entry) {
      return packs[id]!.loadStory?.(id, entry) ?? null;
    },
  };
}

async function createEngine(args: {
  resolver: ContentResolver;
  pixi?: ThreeStub;
  three?: ThreeStub;
}) {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { get: () => 200 });
  Object.defineProperty(container, "clientHeight", { get: () => 200 });
  document.body.appendChild(container);
  const pixi = args.pixi ?? stubRenderer("pixi");
  const three = args.three ?? stubRenderer("three");
  const assets = new AssetManager();
  const tiles = new TileManager(assets, () => {});
  const engine = await ScrollEngine.create(
    {
      container,
      renderers: { pixi: true, three: "lazy" },
      contentResolver: args.resolver,
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
  return { engine, container, pixi, three, tiles };
}

afterEach(async () => {
  document.body.replaceChildren();
});

describe("ScrollEngine loadContent (stub renderers)", () => {
  it("loads meta/plugins/tiles, pans, and destroys without throwing", async () => {
    const { engine, container } = await createEngine({
      resolver: resolverFor({
        "demo-scroll": {
          meta: meta("demo-scroll"),
          scene: scene("demo-scroll"),
        },
      }),
    });

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

describe("story register / unload B-I-01/02/03", () => {
  it("registers a story on load and unregisters on switch (B-I-01/02)", async () => {
    let clicks = 0;
    let registered = 0;
    let cleaned = 0;
    const { engine } = await createEngine({
      resolver: resolverFor({
        "demo-scroll": {
          meta: meta("demo-scroll"),
          scene: scene("demo-scroll", {
            entities: [
              {
                id: "gate-plaque",
                type: "hotspot",
                x: 0,
                y: 0,
                shape: { kind: "rect", w: 40, h: 40 },
                action: { type: "openPanel", payload: { title: "Gate" } },
              },
            ],
          }),
          loadStory: async () => ({
            registerStory(next) {
              registered += 1;
              const off = next.on("entity:click", () => {
                clicks += 1;
              });
              return () => {
                cleaned += 1;
                off();
              };
            },
          }),
        },
        "guide-only-scroll": {
          meta: meta("guide-only-scroll", { plugins: ["guide"], width: 1024, height: 256 }),
          scene: scene("guide-only-scroll", {
            meta: { id: "guide-only-scroll", width: 1024, height: 256 },
            entities: [],
            chapters: [{ id: "west", title: "West grove", centerX: 100, centerY: 128, zoom: 0.5 }],
          }),
          loadStory: async () => ({ registerStory: registerGuideStory }),
        },
      }),
    });

    await engine.loadContent("demo-scroll");
    expect(registered).toBe(1);
    engine.events.emit("entity:click", { entityId: "gate-plaque", renderer: "pixi", interactionPriority: 1, worldX: 1, worldY: 1 });
    expect(clicks).toBe(1);

    await engine.loadContent("guide-only-scroll");
    expect(cleaned).toBe(1);
    expect(engine.getScrollId()).toBe("guide-only-scroll");
    expect(engine.plugins.listIds()).toEqual(["guide"]);
    expect(engine.getScene()?.chapters[0]?.id).toBe("west");
    engine.events.emit("entity:click", { entityId: "gate-plaque", renderer: "pixi", interactionPriority: 1, worldX: 1, worldY: 1 });
    expect(clicks).toBe(1);

    await engine.destroy();
  });

  it("loads without a story module (B-I-03)", async () => {
    const { engine } = await createEngine({
      resolver: resolverFor({
        "raw-only": {
          meta: meta("raw-only", { plugins: [] }),
          scene: scene("raw-only", { entities: [], chapters: [] }),
        },
      }),
    });
    await engine.loadContent("raw-only");
    expect(engine.getScrollId()).toBe("raw-only");
    expect(engine.getScene()?.entities).toEqual([]);
    await engine.destroy();
  });

  it("runs the demo story flyTo on gate-plaque clicks and cleans up", async () => {
    const { engine } = await createEngine({
      resolver: resolverFor({
        "demo-scroll": {
          meta: meta("demo-scroll", { width: 4096, height: 1024, defaultViewport: { centerX: 512, centerY: 512, zoom: 0.55 } }),
          scene: scene("demo-scroll", {
            meta: { id: "demo-scroll", width: 4096, height: 1024 },
            entities: [
              {
                id: "gate-plaque",
                type: "hotspot",
                x: 1580,
                y: 200,
                shape: { kind: "rect", w: 360, h: 220 },
              },
            ],
          }),
          loadStory: async () => ({ registerStory: registerDemoStory }),
        },
        "guide-only-scroll": {
          meta: meta("guide-only-scroll", { plugins: ["guide"], width: 3072, height: 768 }),
          scene: scene("guide-only-scroll", {
            meta: { id: "guide-only-scroll", width: 3072, height: 768 },
            chapters: [],
            entities: [],
          }),
          loadStory: async () => ({ registerStory: registerGuideStory }),
        },
      }),
    });

    await engine.loadContent("demo-scroll");
    engine.events.emit("entity:click", {
      entityId: "gate-plaque",
      renderer: "pixi",
      interactionPriority: 1,
      worldX: 1600,
      worldY: 220,
    });
    expect(engine.camera.isAnimating()).toBe(true);

    await engine.loadContent("guide-only-scroll");
    expect(engine.camera.isAnimating()).toBe(false);
    engine.events.emit("entity:click", {
      entityId: "gate-plaque",
      renderer: "pixi",
      interactionPriority: 1,
      worldX: 1600,
      worldY: 220,
    });
    expect(engine.camera.isAnimating()).toBe(false);
    await engine.destroy();
  });

  it("destroys a story-local plugin when switching packs (P-I-02)", async () => {
    let destroyed = 0;
    const { engine } = await createEngine({
      resolver: resolverFor({
        a: {
          meta: meta("a", { plugins: ["quality"] }),
          scene: scene("a", { chapters: [], entities: [] }),
          loadStory: async () => ({
            registerStory(next) {
              next.plugins.use({
                id: "local-a",
                onDestroy() {
                  destroyed += 1;
                },
              });
            },
          }),
        },
        b: {
          meta: meta("b", { plugins: ["guide"] }),
          scene: scene("b", { chapters: [], entities: [] }),
        },
      }),
    });
    await engine.loadContent("a");
    expect(engine.plugins.listIds()).toEqual(["quality", "local-a"]);
    await engine.loadContent("b");
    expect(destroyed).toBe(1);
    expect(engine.plugins.listIds()).toEqual(["guide"]);
    await engine.destroy();
  });
});

describe("lazy Three path", () => {
  it("does not call ensureLoaded for a 2D-only pack", async () => {
    const three = stubRenderer("three");
    const { engine } = await createEngine({
      three,
      resolver: resolverFor({
        "guide-only-scroll": {
          meta: meta("guide-only-scroll", { plugins: ["guide"], width: 3072, height: 768 }),
          scene: scene("guide-only-scroll", {
            meta: { id: "guide-only-scroll", width: 3072, height: 768 },
            entities: [
              {
                id: "grove-note",
                type: "hotspot",
                x: 10,
                y: 10,
                shape: { kind: "rect", w: 20, h: 10 },
                action: { type: "openPanel", payload: { title: "West grove" } },
              },
            ],
            chapters: [],
          }),
        },
      }),
    });
    await engine.loadContent("guide-only-scroll");
    expect(three.loaded).toBe(0);
    expect(three.entities.some((e) => e.type === "model3d")).toBe(false);
    await engine.destroy();
  });

  it("loads Three and syncs model3d anchors when present", async () => {
    const three = stubRenderer("three");
    const { engine } = await createEngine({
      three,
      resolver: resolverFor({
        "demo-scroll": {
          meta: meta("demo-scroll", { plugins: ["quality", "guide"] }),
          scene: scene("demo-scroll", {
            entities: [{ id: "anchor-box", type: "model3d", x: 2304, y: 512, url: "primitive:box" }],
          }),
        },
        "guide-only-scroll": {
          meta: meta("guide-only-scroll", { plugins: ["guide"] }),
          scene: scene("guide-only-scroll", { entities: [], chapters: [] }),
        },
      }),
    });
    await engine.loadContent("demo-scroll");
    expect(three.loaded).toBe(1);
    expect(three.entities).toEqual([{ id: "anchor-box", type: "model3d", x: 2304, y: 512, url: "primitive:box" }]);

    await engine.loadContent("guide-only-scroll");
    expect(three.entities).toEqual([]);
    expect(three.loaded).toBe(1);
    await engine.destroy();
  });

  it("loads Three when a water plugin is enabled even without model3d", async () => {
    const three = stubRenderer("three");
    const { engine } = await createEngine({
      three,
      resolver: resolverFor({
        wet: {
          meta: meta("wet", { plugins: ["water"] }),
          scene: scene("wet", { entities: [], chapters: [] }),
        },
      }),
    });
    await engine.loadContent("wet");
    expect(three.loaded).toBe(1);
    await engine.destroy();
  });
});

describe("pack isolation of plugins and tiles", () => {
  it("rebuilds the guide rail and clears tiles when switching packs", async () => {
    const { engine, container } = await createEngine({
      resolver: resolverFor({
        "demo-scroll": {
          meta: meta("demo-scroll", { plugins: ["quality", "guide"] }),
          scene: scene("demo-scroll", {
            chapters: [{ id: "bridge", title: "Bridge", centerX: 1500, centerY: 256, zoom: 0.8 }],
          }),
        },
        "guide-only-scroll": {
          meta: meta("guide-only-scroll", { plugins: ["guide"], width: 3072, height: 768 }),
          scene: scene("guide-only-scroll", {
            meta: { id: "guide-only-scroll", width: 3072, height: 768 },
            chapters: [
              { id: "west", title: "West grove", centerX: 320, centerY: 384, zoom: 0.85 },
              { id: "east", title: "East terrace", centerX: 2750, centerY: 384, zoom: 0.85 },
            ],
          }),
        },
      }),
    });

    await engine.loadContent("demo-scroll");
    expect(engine.plugins.listIds()).toEqual(["quality", "guide"]);
    expect([...container.querySelectorAll(".guide-rail__dot")].map((n) => n.textContent)).toEqual(["Bridge"]);

    await engine.loadContent("guide-only-scroll");
    expect(engine.plugins.listIds()).toEqual(["guide"]);
    expect([...container.querySelectorAll(".guide-rail__dot")].map((n) => n.textContent)).toEqual([
      "West grove",
      "East terrace",
    ]);
    expect(engine.getScene()?.meta.width).toBe(3072);
    expect(container.querySelector(".story-panel")).toBeTruthy();
    await engine.destroy();
  });
});
