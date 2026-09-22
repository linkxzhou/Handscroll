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

/** Screen HUD. Night is `atmosphere:night` on the tile layer, not a DOM wash. */
export function createAtmosphereController(engine: AtmosphereEngine): AtmosphereController {
  let rain = false;
  let night = false;
  let water = true;
  let muted = true;
  let disposed = false;
  const hud = mountHud(engine.getUiLayer());

  const snapshot = (): AtmosphereSnapshot => ({
    rain,
    night,
    water,
    muted,
    weather: rain ? "rain" : "clear",
    disposed,
  });

  const syncHud = (): void => {
    if (!hud) return;
    hud.rainBtn.classList.toggle("is-on", rain);
    hud.nightBtn.classList.toggle("is-on", night);
    hud.waterBtn.classList.toggle("is-on", water);
    hud.audioBtn.classList.toggle("is-on", !muted);
    hud.rainBtn.setAttribute("aria-pressed", String(rain));
    hud.nightBtn.setAttribute("aria-pressed", String(night));
    hud.waterBtn.setAttribute("aria-pressed", String(water));
    hud.audioBtn.setAttribute("aria-pressed", String(!muted));
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

  const syncNight = (): void => {
    engine.events.emit("atmosphere:night", { enabled: night });
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
    syncNight();
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
    engine.events.emit("audio:setMuted", { muted });
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
    syncNight();
    engine.events.emit("audio:setMuted", { muted: true });
    hud?.root.remove();
  };

  if (hud) {
    hud.rainBtn.addEventListener("click", () => setRain(!rain));
    hud.nightBtn.addEventListener("click", () => setNight(!night));
    hud.waterBtn.addEventListener("click", () => setWater(!water));
    hud.audioBtn.addEventListener("click", () => setMuted(!muted));
  }

  syncHud();
  syncWeather();
  syncWater();
  syncNight();
  engine.events.emit("audio:setMuted", { muted });

  return { setRain, setNight, setWater, setMuted, dispose, getState: snapshot };
}

interface HudNodes {
  root: HTMLElement;
  rainBtn: HTMLButtonElement;
  nightBtn: HTMLButtonElement;
  waterBtn: HTMLButtonElement;
  audioBtn: HTMLButtonElement;
}

function mountHud(ui: HTMLElement | null | undefined): HudNodes | null {
  if (!ui || typeof document === "undefined") return null;
  const root = document.createElement("div");
  root.className = "qingming-atmo";
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", copy["atmo.toolbar"] ?? "氛围");
  const rainBtn = pill(copy["atmo.rain"] ?? "时雨");
  const nightBtn = pill(copy["atmo.night"] ?? "夜景");
  const waterBtn = pill(copy["atmo.water"] ?? "水面");
  const audioBtn = pill(copy["atmo.audio"] ?? "音效");
  root.append(rainBtn, nightBtn, waterBtn, audioBtn);
  ui.appendChild(root);
  return { root, rainBtn, nightBtn, waterBtn, audioBtn };
}

function pill(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  return btn;
}
