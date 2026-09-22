import type {
  EngineContext,
  PluginFactory,
  ScrollPlugin,
  ThreeOverlayHost,
  ViewportState,
} from "@handscroll/core";

export interface WaterBand {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WaterComposite = "three-overlay" | "pixi-underlay";

export interface WaterPluginConfig {
  enabled?: boolean;
  bands?: WaterBand[];
  /**
   * `three-overlay` covers the Pixi view (default, no hulls on the water).
   * `pixi-underlay` draws the band above tiles and below actors.
   */
  composite?: WaterComposite;
}

export const WATER_CONTINUOUS_REASON = "water";
export const WATER_STYLE_ID = "handscroll-water-css";

const WATER_CSS = `
.hs-water-fallback {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  overflow: hidden;
  border-radius: 0;
  mix-blend-mode: multiply;
  opacity: 0.55;
  background: linear-gradient(180deg, rgba(70, 118, 122, 0.18), rgba(42, 86, 96, 0.38));
}
.hs-water-fallback::after {
  content: "";
  position: absolute;
  inset: -40% 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0 10px,
    rgba(180, 214, 210, 0.22) 10px 12px
  );
  animation: hs-water-drift 3.2s linear infinite;
}
@keyframes hs-water-drift {
  from { transform: translateY(0); }
  to { transform: translateY(12%); }
}
`;

export interface WaterEffectHandle {
  object: unknown;
  setTime(t: number): void;
  dispose(): void;
}

export function parseWaterComposite(value: unknown): WaterComposite {
  return value === "pixi-underlay" ? "pixi-underlay" : "three-overlay";
}

export function parseWaterEnabled(payload: unknown, fallback: boolean): boolean {
  if (payload && typeof payload === "object" && "enabled" in payload) {
    return Boolean((payload as { enabled: unknown }).enabled);
  }
  if (typeof payload === "boolean") return payload;
  return fallback;
}

export function worldRectToScreen(
  viewport: ViewportState,
  band: WaterBand,
): { left: number; top: number; width: number; height: number } {
  return {
    left: (band.x - viewport.centerX) * viewport.zoom + viewport.screenWidth / 2,
    top: (band.y - viewport.centerY) * viewport.zoom + viewport.screenHeight / 2,
    width: band.w * viewport.zoom,
    height: band.h * viewport.zoom,
  };
}

export const createWaterPlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as WaterPluginConfig;
  const composite = parseWaterComposite(config.composite);
  const bands = (config.bands ?? []).filter((b) => b.w > 0 && b.h > 0);
  let enabled = config.enabled !== false && bands.length > 0;
  let ctx: EngineContext | null = null;
  let host: ThreeOverlayHost | null = null;
  let effect: WaterEffectHandle | null = null;
  let fallbackRoot: HTMLElement | null = null;
  let offSet: (() => void) | null = null;
  let time = 0;
  let attachToken = 0;
  let path: "three" | "dom" | "pixi" | "none" = "none";

  const syncScheduler = (): void => {
    const scheduler = ctx?.engine.scheduler;
    if (!scheduler) return;
    if (enabled && bands.length > 0 && (path === "three" || path === "dom" || path === "pixi")) {
      scheduler.requestContinuous(WATER_CONTINUOUS_REASON);
      scheduler.requestFrame();
    } else {
      scheduler.releaseContinuous(WATER_CONTINUOUS_REASON);
    }
  };

  const layoutFallback = (): void => {
    if (!fallbackRoot || !ctx) return;
    const vp = ctx.engine.getViewport();
    const children = fallbackRoot.children;
    for (let i = 0; i < bands.length; i += 1) {
      const band = bands[i];
      const el = children[i] as HTMLElement | undefined;
      if (!band || !el) continue;
      const box = worldRectToScreen(vp, band);
      el.style.left = `${box.left}px`;
      el.style.top = `${box.top}px`;
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
    }
  };

  const mountFallback = (): void => {
    if (fallbackRoot || typeof document === "undefined") return;
    const ui = ctx?.engine.getUiLayer();
    if (!ui) return;
    ensureWaterStyles();
    fallbackRoot = document.createElement("div");
    fallbackRoot.className = "hs-water-fallback-root";
    fallbackRoot.setAttribute("aria-hidden", "true");
    fallbackRoot.style.position = "absolute";
    fallbackRoot.style.inset = "0";
    fallbackRoot.style.pointerEvents = "none";
    fallbackRoot.style.zIndex = "2";
    for (const band of bands) {
      const el = document.createElement("div");
      el.className = "hs-water-fallback";
      el.title = "Water fallback (DOM). Three overlay unavailable — see plan/adr/0002-water-effect.md";
      el.dataset.x = String(band.x);
      fallbackRoot.appendChild(el);
    }
    ui.appendChild(fallbackRoot);
    layoutFallback();
  };

  const unmountFallback = (): void => {
    fallbackRoot?.remove();
    fallbackRoot = null;
    if (typeof document !== "undefined") document.getElementById(WATER_STYLE_ID)?.remove();
  };

  const detachThree = (): void => {
    if (effect && host) host.detach(effect.object);
    effect?.dispose();
    effect = null;
  };

  const teardownVisuals = (): void => {
    detachThree();
    unmountFallback();
    ctx?.engine.setUnderlay?.(null);
    host = null;
    path = "none";
    syncScheduler();
  };

  const publishUnderlay = (): void => {
    ctx?.engine.setUnderlay?.(
      bands.map((band) => ({
        x: band.x,
        y: band.y,
        w: band.w,
        h: band.h,
        time,
      })),
    );
  };

  const attachVisuals = async (): Promise<void> => {
    if (!ctx || !enabled || bands.length === 0) {
      teardownVisuals();
      return;
    }
    if (composite === "pixi-underlay") {
      detachThree();
      unmountFallback();
      host = null;
      path = "pixi";
      publishUnderlay();
      syncScheduler();
      return;
    }
    const token = ++attachToken;
    try {
      const nextHost = await ctx.engine.ensureThree();
      if (token !== attachToken || !enabled) return;
      if (nextHost) {
        const mod = await import("@handscroll/renderer-three");
        if (token !== attachToken || !enabled) return;
        detachThree();
        unmountFallback();
        host = nextHost;
        effect = mod.createWaterEffect(bands);
        host.attach(effect.object);
        path = "three";
        syncScheduler();
        return;
      }
    } catch {
      /* headless / missing WebGL — fall through to DOM */
    }
    if (token !== attachToken || !enabled) return;
    detachThree();
    host = null;
    mountFallback();
    path = fallbackRoot ? "dom" : "none";
    syncScheduler();
  };

  const setEnabled = (next: boolean): void => {
    enabled = next && bands.length > 0;
    if (!enabled) attachToken += 1;
    ctx?.engine.events.emit("water:change", { enabled, path });
    void attachVisuals();
  };

  return {
    id: "water",
    priority: 12,
    onRegister(next) {
      ctx = next;
      offSet?.();
      offSet = next.engine.events.on("water:set", (payload) => {
        setEnabled(parseWaterEnabled(payload, enabled));
      });
    },
    onSceneLoad() {
      void attachVisuals();
    },
    onSceneUnload() {
      attachToken += 1;
      teardownVisuals();
    },
    onFrame(dt, viewport) {
      if (!enabled) return;
      time += dt;
      effect?.setTime(time);
      if (path === "pixi") publishUnderlay();
      if (path === "dom") {
        layoutFallback();
        void viewport;
      }
    },
    onDestroy() {
      attachToken += 1;
      offSet?.();
      offSet = null;
      teardownVisuals();
      ctx = null;
    },
  };
};

function ensureWaterStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(WATER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WATER_STYLE_ID;
  style.textContent = WATER_CSS;
  document.head.appendChild(style);
}
