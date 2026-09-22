import type { EngineContext, EventBusLike, PluginFactory, ScrollPlugin } from "@handscroll/core";

export type WeatherId = "clear" | "rain" | "snow" | "mist";

export const WEATHER_IDS: readonly WeatherId[] = ["clear", "rain", "snow", "mist"];

export const WEATHER_CONTINUOUS_REASON = "weather";
export const WEATHER_STYLE_ID = "handscroll-weather-css";

const WEATHER_CSS = `
.hs-weather {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
}
.hs-weather[data-weather="clear"] { display: none; }
.hs-weather[data-weather="rain"] {
  background: linear-gradient(180deg, rgba(36, 52, 68, 0.10), rgba(28, 40, 52, 0.22));
}
.hs-weather[data-weather="rain"]::before {
  content: "";
  position: absolute;
  inset: -40% 0 0 0;
  background-image: repeating-linear-gradient(
    18deg,
    transparent 0 11px,
    rgba(210, 224, 236, 0.28) 11px 12px,
    transparent 12px 22px
  );
  animation: hs-weather-rain 0.55s linear infinite;
}
.hs-weather[data-weather="snow"] {
  background: rgba(210, 220, 230, 0.12);
}
.hs-weather[data-weather="snow"]::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.7) 0 1px, transparent 1.5px);
  background-size: 28px 28px;
  animation: hs-weather-drift 4s linear infinite;
  opacity: 0.7;
}
.hs-weather[data-weather="mist"] {
  background: radial-gradient(ellipse at 50% 70%, rgba(210, 214, 208, 0.28), rgba(180, 188, 186, 0.08));
  backdrop-filter: blur(0.4px);
}
@keyframes hs-weather-rain {
  from { transform: translateY(-8%); }
  to { transform: translateY(18%); }
}
@keyframes hs-weather-drift {
  from { background-position: 0 0; }
  to { background-position: 18px 48px; }
}
`;

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === "string" && (WEATHER_IDS as readonly string[]).includes(value);
}

export function parseWeatherPayload(payload: unknown): WeatherId | null {
  if (isWeatherId(payload)) return payload;
  if (payload && typeof payload === "object" && "id" in payload) {
    const id = (payload as { id: unknown }).id;
    if (isWeatherId(id)) return id;
  }
  return null;
}

export function setWeather(events: EventBusLike, id: WeatherId): void {
  events.emit("weather:set", { id });
}

export const createWeatherPlugin: PluginFactory = (_raw): ScrollPlugin => {
  let weather: WeatherId = "clear";
  let ctx: EngineContext | null = null;
  let overlay: HTMLElement | null = null;
  let offSet: (() => void) | null = null;

  const applyVisual = (): void => {
    if (!overlay) return;
    overlay.dataset.weather = weather;
    overlay.setAttribute("data-weather", weather);
  };

  const syncScheduler = (): void => {
    const scheduler = ctx?.engine.scheduler;
    if (!scheduler) return;
    if (weather === "clear") scheduler.releaseContinuous(WEATHER_CONTINUOUS_REASON);
    else {
      scheduler.requestContinuous(WEATHER_CONTINUOUS_REASON);
      scheduler.requestFrame();
    }
  };

  const mountOverlay = (): void => {
    if (overlay || typeof document === "undefined") return;
    const ui = ctx?.engine.getUiLayer();
    if (!ui) return;
    ensureWeatherStyles();
    overlay = document.createElement("div");
    overlay.className = "hs-weather";
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.weather = weather;
    ui.appendChild(overlay);
    applyVisual();
  };

  const unmountOverlay = (): void => {
    overlay?.remove();
    overlay = null;
    if (typeof document !== "undefined") document.getElementById(WEATHER_STYLE_ID)?.remove();
  };

  const setId = (id: WeatherId): void => {
    weather = id;
    mountOverlay();
    applyVisual();
    syncScheduler();
    ctx?.engine.events.emit("weather:change", { id: weather });
  };

  return {
    id: "weather",
    priority: 15,
    onRegister(next) {
      ctx = next;
      offSet?.();
      offSet = next.engine.events.on("weather:set", (payload) => {
        const id = parseWeatherPayload(payload);
        if (id) setId(id);
      });
    },
    onSceneLoad() {
      mountOverlay();
      applyVisual();
      syncScheduler();
    },
    onSceneUnload() {
      setId("clear");
      unmountOverlay();
    },
    onFrame() {
      /* CSS overlay is the first-pass visual; hook remains for particle upgrades */
    },
    onDestroy() {
      offSet?.();
      offSet = null;
      ctx?.engine.scheduler.releaseContinuous(WEATHER_CONTINUOUS_REASON);
      unmountOverlay();
      weather = "clear";
      ctx = null;
    },
  };
};

function ensureWeatherStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(WEATHER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WEATHER_STYLE_ID;
  style.textContent = WEATHER_CSS;
  document.head.appendChild(style);
}
