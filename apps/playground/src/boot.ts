import { ScrollEngine } from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { createPixiRenderer } from "@handscroll/renderer-pixi";
import { createLazyThreeRenderer } from "@handscroll/renderer-three";
import { builtinPlugins } from "@handscroll/plugins";
import { createFetchResolver } from "@handscroll/scene";
import type { QualityLevel, StoryModule } from "@handscroll/core";

const storyLoaders = import.meta.glob("../../../contents/*/story/index.ts");

async function loadStory(scrollId: string): Promise<StoryModule | null> {
  const needle = `/contents/${scrollId}/story/index.ts`;
  const key = Object.keys(storyLoaders).find((k) => k.replaceAll("\\", "/").endsWith(needle));
  if (!key) return null;
  return (await storyLoaders[key]!()) as StoryModule;
}

export async function bootHandscroll(container: HTMLElement, scrollId: string): Promise<ScrollEngine> {
  const assets = new AssetManager();
  const schedulerWake = { current: () => {} };
  const tiles = new TileManager(assets, () => schedulerWake.current());
  const engine = await ScrollEngine.create(
    {
      container,
      renderers: { pixi: true, three: "lazy" },
      quality: "auto",
      contentResolver: createFetchResolver({ baseUrl: "/contents", loadStory }),
      adapters: {
        createPixi: createPixiRenderer,
        createThree: createLazyThreeRenderer,
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
  schedulerWake.current = () => engine.scheduler.wake();
  await engine.loadContent(scrollId);
  return engine;
}

export function parseScrollId(): string {
  const params = new URLSearchParams(location.search);
  return params.get("scroll") ?? "demo-scroll";
}

export function isQuality(value: string): value is QualityLevel {
  return value === "auto" || value === "low" || value === "medium" || value === "high";
}
