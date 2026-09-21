import { ScrollEngine } from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { createPixiRenderer } from "@handscroll/renderer-pixi";
import { createLazyThreeRenderer } from "@handscroll/renderer-three";
import { builtinPlugins } from "@handscroll/plugins";
import { createFetchResolver } from "@handscroll/scene";

export { isQuality, parseScrollId, formatViewportHud } from "./query.ts";

export async function bootHandscroll(container: HTMLElement, scrollId: string): Promise<ScrollEngine> {
  const assets = new AssetManager();
  const schedulerWake = { current: () => {} };
  const tiles = new TileManager(assets, () => schedulerWake.current());
  const engine = await ScrollEngine.create(
    {
      container,
      renderers: { pixi: true, three: "lazy" },
      quality: "auto",
      contentResolver: createFetchResolver({ baseUrl: "/contents" }),
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
