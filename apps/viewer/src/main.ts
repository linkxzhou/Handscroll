import "./style.css";
import { ScrollEngine } from "@handscroll/core";
import { AssetManager } from "@handscroll/assets";
import { TileManager } from "@handscroll/tiles";
import { InteractionManager } from "@handscroll/interaction";
import { AnimationRuntime } from "@handscroll/animation";
import { createPixiRenderer } from "@handscroll/renderer-pixi";
import { createLazyThreeRenderer } from "@handscroll/renderer-three";
import { builtinPlugins } from "@handscroll/plugins";
import { createFetchResolver } from "@handscroll/scene";

const KNOWN_SCROLLS = ["demo-scroll"];

const container = document.querySelector<HTMLElement>("#app");
const select = document.querySelector<HTMLSelectElement>("#scroll");
if (!container || !select) throw new Error("viewer chrome missing");

const params = new URLSearchParams(location.search);
const initial = params.get("scroll") ?? "demo-scroll";

for (const id of KNOWN_SCROLLS) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = id;
  select.appendChild(opt);
}
select.value = initial;

const assets = new AssetManager();
const wake = { current: () => {} };
const tiles = new TileManager(assets, () => wake.current());

const engine = await ScrollEngine.create(
  {
    container,
    renderers: { pixi: true, three: "lazy" },
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
wake.current = () => engine.scheduler.wake();

await engine.loadContent(initial);

select.addEventListener("change", async () => {
  const id = select.value;
  const url = new URL(location.href);
  url.searchParams.set("scroll", id);
  history.replaceState({}, "", url);
  await engine.loadContent(id);
});

declare global {
  interface Window {
    __handscroll__?: { engine: ScrollEngine };
  }
}
window.__handscroll__ = { engine };
