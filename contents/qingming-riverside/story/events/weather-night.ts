import type { EventBusLike, SchedulerLike } from "@handscroll/core";
import zh from "../../i18n/zh-CN.json";

type Copy = Record<string, string>;
const copy = zh as Copy;

export type AtmosphereWeather = "clear" | "rain";

export interface AtmosphereSnapshot {
  rain: boolean;
  night: boolean;
  water: boolean;
  muted: boolean;
  weather: AtmosphereWeather;
  disposed: boolean;
}

export interface AtmosphereEngine {
  events: EventBusLike;
  scheduler: SchedulerLike;
  getUiLayer(): HTMLElement;
}

export interface AtmosphereController {
  setRain(on: boolean): void;
  setNight(on: boolean): void;
  setWater(on: boolean): void;
  setMuted(on: boolean): void;
  dispose(): void;
  getState(): AtmosphereSnapshot;
}

export function createAtmosphereController(engine: AtmosphereEngine): AtmosphereController {
  let rain = false;
  let night = false;
  let water = true;
  let muted = true;
  let disposed = false;
  const overlays = mountAtmosphere(engine.getUiLayer());

  const snapshot = (): AtmosphereSnapshot => ({
    rain,
    night,
    water,
    muted,
    weather: rain ? "rain" : "clear",
    disposed,
  });

  const syncHud = (): void => {
    if (!overlays) return;
    overlays.night.hidden = !night;
    overlays.rainBtn.classList.toggle("is-on", rain);
    overlays.nightBtn.classList.toggle("is-on", night);
    overlays.waterBtn.classList.toggle("is-on", water);
    overlays.audioBtn.classList.toggle("is-on", !muted);
    overlays.rainBtn.setAttribute("aria-pressed", String(rain));
    overlays.nightBtn.setAttribute("aria-pressed", String(night));
    overlays.waterBtn.setAttribute("aria-pressed", String(water));
    overlays.audioBtn.setAttribute("aria-pressed", String(!muted));
  };

  const syncWeather = (): void => {
    engine.events.emit("weather:set", { id: rain ? "rain" : "clear" });
    if (rain) engine.events.emit("audio:play", { id: "ambient-rain", kind: "rain" });
    else engine.events.emit("audio:stop", { id: "ambient-rain" });
  };

  const syncWater = (): void => {
    engine.events.emit("water:set", { enabled: water });
    if (water) engine.events.emit("audio:play", { id: "ambient-water", kind: "water" });
    else engine.events.emit("audio:stop", { id: "ambient-water" });
  };

  const syncMuted = (): void => {
    engine.events.emit("audio:setMuted", { muted });
  };

  const setRain = (on: boolean): void => {
    if (disposed) return;
    rain = on;
    syncWeather();
    syncHud();
    engine.scheduler.requestFrame();
  };

  const setNight = (on: boolean): void => {
    if (disposed) return;
    night = on;
    syncHud();
    engine.scheduler.requestFrame();
  };

  const setWater = (on: boolean): void => {
    if (disposed) return;
    water = on;
    syncWater();
    syncHud();
    engine.scheduler.requestFrame();
  };

  const setMuted = (on: boolean): void => {
    if (disposed) return;
    muted = on;
    syncMuted();
    syncHud();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    rain = false;
    night = false;
    water = false;
    muted = true;
    syncWeather();
    syncWater();
    syncMuted();
    overlays?.hud.remove();
    overlays?.night.remove();
  };

  if (overlays) {
    overlays.rainBtn.addEventListener("click", () => setRain(!rain));
    overlays.nightBtn.addEventListener("click", () => setNight(!night));
    overlays.waterBtn.addEventListener("click", () => setWater(!water));
    overlays.audioBtn.addEventListener("click", () => setMuted(!muted));
  }

  syncHud();
  syncWeather();
  syncWater();
  syncMuted();

  return { setRain, setNight, setWater, setMuted, dispose, getState: snapshot };
}

interface AtmosphereOverlays {
  hud: HTMLElement;
  night: HTMLElement;
  rainBtn: HTMLButtonElement;
  nightBtn: HTMLButtonElement;
  waterBtn: HTMLButtonElement;
  audioBtn: HTMLButtonElement;
}

function mountAtmosphere(ui: HTMLElement | null | undefined): AtmosphereOverlays | null {
  if (!ui || typeof document === "undefined") return null;

  const night = document.createElement("div");
  night.className = "qingming-night";
  night.hidden = true;
  night.setAttribute("aria-hidden", "true");
  night.title = "Faked night: multiply color wash, not a second tile set";
  ui.appendChild(night);

  const hud = document.createElement("div");
  hud.className = "qingming-atmo";
  hud.setAttribute("role", "toolbar");
  hud.setAttribute("aria-label", copy["atmo.toolbar"] ?? "氛围");

  const rainBtn = pill(copy["atmo.rain"] ?? "时雨");
  const nightBtn = pill(copy["atmo.night"] ?? "夜景");
  const waterBtn = pill(copy["atmo.water"] ?? "水面");
  const audioBtn = pill(copy["atmo.audio"] ?? "音效");
  hud.append(rainBtn, nightBtn, waterBtn, audioBtn);
  ui.appendChild(hud);

  return { hud, night, rainBtn, nightBtn, waterBtn, audioBtn };
}

function pill(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  return btn;
}
