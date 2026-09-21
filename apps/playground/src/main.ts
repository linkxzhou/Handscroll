import "./style.css";
import { bootHandscroll, isQuality, parseScrollId } from "./boot.ts";

const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("#app missing");

const scrollId = parseScrollId();
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
    hudCam.textContent = `z ${vp.zoom.toFixed(2)} · (${vp.centerX.toFixed(0)}, ${vp.centerY.toFixed(0)})`;
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
