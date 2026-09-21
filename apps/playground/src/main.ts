import "./style.css";
import { bootHandscroll } from "./boot.ts";
import { formatViewportHud, isQuality, parseScrollId } from "./query.ts";

const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("#app missing");

const scrollId = parseScrollId(location.search);
const engine = await bootHandscroll(container, scrollId);

const hudScroll = document.querySelector("#hud-scroll");
const hudCam = document.querySelector("#hud-cam");
const quality = document.querySelector<HTMLSelectElement>("#quality");
if (hudScroll) hudScroll.textContent = scrollId;
if (quality) quality.value = engine.getQuality();

quality?.addEventListener("change", () => {
  const value = quality.value;
  if (isQuality(value)) engine.setQuality(value);
});

const tickHud = () => {
  const vp = engine.getViewport();
  if (hudCam) {
    hudCam.textContent = formatViewportHud(vp);
  }
  requestAnimationFrame(tickHud);
};
tickHud();

declare global {
  interface Window {
    __handscroll__?: {
      getViewport: () => ReturnType<typeof engine.getViewport>;
      engine: typeof engine;
    };
  }
}

window.__handscroll__ = {
  getViewport: () => engine.getViewport(),
  engine,
};
