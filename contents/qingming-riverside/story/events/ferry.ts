import type { SchedulerLike, ViewportState } from "@handscroll/core";
import { BERTHS, BOAT_SPRITE, worldToScreen, type WorldPoint } from "../coords.ts";

export type BerthId = keyof typeof BERTHS;
export type FerryMode = "idle" | "crossing";

export const FERRY_CONTINUOUS_REASON = "qingming:ferry";
export const CROSSING_SECONDS = 4;

export interface FerrySnapshot {
  mode: FerryMode;
  x: number;
  y: number;
  berth: BerthId;
  origin: BerthId;
  destination: BerthId;
  progress: number;
  direction: 1 | -1;
  disposed: boolean;
}

export interface FerryEngine {
  scheduler: SchedulerLike;
  getViewport(): ViewportState;
  getUiLayer(): HTMLElement;
  getScrollId(): string | null;
}

export interface FerryController {
  summon(entityId: string): boolean;
  step(dt: number): void;
  dispose(): void;
  getState(): FerrySnapshot;
}

export function oppositeBerth(berth: BerthId): BerthId {
  return berth === "east" ? "west" : "east";
}

export function dockIdToBerth(entityId: string): BerthId | null {
  const id = entityId.toLowerCase();
  if (!id.startsWith("dock-")) return null;
  if (id.includes("west")) return "west";
  if (id.includes("east")) return "east";
  return null;
}

export function berthPoint(berth: BerthId): WorldPoint {
  const p = BERTHS[berth];
  return { x: p.x, y: p.y };
}

function easeInOutCosine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

export function createFerryController(engine: FerryEngine, options: { boatUrl?: string; autoTick?: boolean } = {}): FerryController {
  const start = berthPoint("east");
  let mode: FerryMode = "idle";
  let x = start.x;
  let y = start.y;
  let berth: BerthId = "east";
  let origin: BerthId = "east";
  let destination: BerthId = "east";
  let progress = 0;
  let direction: 1 | -1 = 1;
  let disposed = false;
  let raf = 0;
  let lastNow = 0;

  const autoTick = options.autoTick ?? typeof requestAnimationFrame === "function";
  const boatUrl =
    options.boatUrl ??
    `/contents/${engine.getScrollId() ?? "qingming-riverside"}/atlas/boat.webp`;
  const boatEl = mountBoat(engine.getUiLayer(), boatUrl);

  const snapshot = (): FerrySnapshot => ({
    mode,
    x,
    y,
    berth,
    origin,
    destination,
    progress,
    direction,
    disposed,
  });

  const syncOverlay = (): void => {
    if (!boatEl) return;
    const vp = engine.getViewport();
    const left = x - BOAT_SPRITE.anchorX;
    const top = y - BOAT_SPRITE.anchorY;
    const screen = worldToScreen(vp, left, top);
    const w = BOAT_SPRITE.width * vp.zoom;
    const h = BOAT_SPRITE.height * vp.zoom;
    boatEl.style.left = `${screen.x}px`;
    boatEl.style.top = `${screen.y}px`;
    boatEl.style.width = `${w}px`;
    boatEl.style.height = `${h}px`;
    boatEl.style.transform = direction === -1 ? "scaleX(-1)" : "scaleX(1)";
    boatEl.style.transformOrigin = "center center";
  };

  const stopTick = (): void => {
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
    lastNow = 0;
  };

  const tick = (now: number): void => {
    raf = 0;
    if (disposed) return;
    if (!lastNow) lastNow = now;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    step(dt);
    if (!disposed && (mode === "crossing" || boatEl)) {
      raf = requestAnimationFrame(tick);
    }
  };

  const ensureTick = (): void => {
    if (!autoTick || disposed || raf) return;
    lastNow = 0;
    raf = requestAnimationFrame(tick);
  };

  const step = (dt: number): void => {
    if (disposed || dt <= 0) {
      syncOverlay();
      return;
    }
    if (mode === "crossing") {
      progress = Math.min(1, progress + dt / CROSSING_SECONDS);
      const a = berthPoint(origin);
      const b = berthPoint(destination);
      const e = easeInOutCosine(progress);
      x = a.x + (b.x - a.x) * e;
      y = a.y + 36 * Math.sin(Math.PI * e) ** 2;
      if (progress >= 1) {
        x = b.x;
        y = b.y;
        berth = destination;
        mode = "idle";
        progress = 1;
        engine.scheduler.releaseContinuous(FERRY_CONTINUOUS_REASON);
        engine.scheduler.requestFrame();
      } else {
        engine.scheduler.requestFrame();
      }
    }
    syncOverlay();
  };

  const summon = (entityId: string): boolean => {
    if (disposed) return false;
    const clicked = dockIdToBerth(entityId);
    if (!clicked) return false;
    if (mode === "crossing") return false;
    const dest = clicked === berth ? oppositeBerth(clicked) : clicked;
    origin = berth;
    destination = dest;
    progress = 0;
    mode = "crossing";
    direction = dest === "west" ? -1 : 1;
    engine.scheduler.requestContinuous(FERRY_CONTINUOUS_REASON);
    engine.scheduler.requestFrame();
    ensureTick();
    return true;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mode = "idle";
    progress = 0;
    stopTick();
    engine.scheduler.releaseContinuous(FERRY_CONTINUOUS_REASON);
    boatEl?.remove();
  };

  syncOverlay();
  ensureTick();

  return { summon, step, dispose, getState: snapshot };
}

function mountBoat(ui: HTMLElement | null | undefined, url: string): HTMLImageElement | null {
  if (!ui || typeof document === "undefined") return null;
  const img = document.createElement("img");
  img.className = "qingming-boat";
  img.alt = "";
  img.src = url;
  img.setAttribute("aria-hidden", "true");
  img.draggable = false;
  ui.appendChild(img);
  return img;
}

/** @deprecated use createFerryController — alias for tests that talk about the state machine. */
export function createFerryStateMachine(engine: FerryEngine, options?: { boatUrl?: string; autoTick?: boolean }): FerryController {
  return createFerryController(engine, options);
}
