import "./style.css";
import { ScrollEngine } from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { WorldRuntime } from "@handscroll/world";
import { createPixiRenderer } from "@handscroll/renderer-pixi";
import { createLazyThreeRenderer } from "@handscroll/renderer-three";
import { builtinPlugins } from "@handscroll/plugins";
import { createFetchResolver } from "@handscroll/scene";
import type { StoryModule } from "@handscroll/core";
import { loadPublishedPacksFromGlob } from "./packs.ts";
import { renderGallery } from "./gallery.ts";

declare global {
  interface Window {
    __handscroll__?: { engine: ScrollEngine };
  }
}

const metaModules = import.meta.glob("../../../contents/*/meta.json", { eager: true });
const coverModules = import.meta.glob("../../../contents/*/preview/cover.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const publishedPacks = loadPublishedPacksFromGlob(metaModules, coverModules);
const storyLoaders = import.meta.glob("../../../contents/*/story/index.ts");

async function loadStory(scrollId: string): Promise<StoryModule | null> {
  const needle = `/contents/${scrollId}/story/index.ts`;
  const key = Object.keys(storyLoaders).find((k) => k.replaceAll("\\", "/").endsWith(needle));
  if (!key) return null;
  return (await storyLoaders[key]!()) as StoryModule;
}

const home = document.querySelector<HTMLElement>("#home");
const stage = document.querySelector<HTMLElement>("#stage");
const container = document.querySelector<HTMLElement>("#app");
const packTitle = document.querySelector<HTMLElement>("#pack-title");
if (!home || !stage || !container) throw new Error("viewer chrome missing");

const params = new URLSearchParams(location.search);
const scrollId = params.get("scroll")?.trim() || null;

if (!scrollId) {
  document.body.classList.add("is-home");
  home.hidden = false;
  renderGallery(home, publishedPacks);
} else {
  stage.hidden = false;
  const pack = publishedPacks.find((p) => p.id === scrollId);
  if (packTitle) packTitle.textContent = pack?.title ?? scrollId;
  document.title = pack?.title ? `${pack.title} · 手卷` : "手卷";

  const assets = new AssetManager();
  const wake = { current: () => {} };
  const tiles = new TileManager(assets, () => wake.current());

  const engine = await ScrollEngine.create(
    {
      container,
      renderers: { pixi: true, three: "lazy" },
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
      world: new WorldRuntime(),
    },
  );
  wake.current = () => engine.scheduler.wake();

  await engine.loadContent(scrollId);
  window.__handscroll__ = { engine };
}
