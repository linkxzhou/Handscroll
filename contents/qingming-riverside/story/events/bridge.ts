import type { FlyToOptions, SchedulerLike, ViewportState } from "@handscroll/core";
import {
  BOAT_SPRITE,
  BRIDGE_APEX,
  BRIDGE_CARGO_SCALE,
  BRIDGE_OCCLUDER,
  BRIDGE_PATH,
  CHAPTERS,
  worldToScreen,
} from "../coords.ts";

/**
 * Simplified 虹桥过船 story (Phase D). Semantics follow upstream `bridge-event.js`
 * (approach → lower mast / optional haul → pass under arch → done) but this is not
 * a Canvas2D port: timings are shorter, crowd/art-record stages are omitted, and
 * arch occlusion is a DOM strip over the tile layer (see README).
 */
export type BridgeMode = "idle" | "approaching" | "mast" | "under" | "done";

export const BRIDGE_ENTITY_ID = "bridge-event";
export const BRIDGE_CONTINUOUS_REASON = "qingming:bridge";
export const APPROACH_SECONDS = 4;
export const MAST_SECONDS = 3.5;
export const UNDER_SECONDS = 4;
export const DONE_SECONDS = 2;
export const HAUL_BOOST = 1.75;

export const STAGE_COPY: Record<BridgeMode, string> = {
  idle: "虹桥过船",
  approaching: "货船正在靠近虹桥",
  mast: "船工正在降桅。按住牵绳协助，或旁观等待。",
  under: "船正在过桥。继续牵绳或旁观。",
  done: "船已通过虹桥。",
};

export interface BridgeSnapshot {
  mode: BridgeMode;
  x: number;
  y: number;
  scale: number;
  mast: number;
  progress: number;
  haul: boolean;
  occluded: boolean;
  disposed: boolean;
}

export interface BridgeEngine {
  scheduler: SchedulerLike;
  camera: { flyTo(opts: FlyToOptions): void };
  getViewport(): ViewportState;
  getUiLayer(): HTMLElement;
  getScrollId(): string | null;
}

export interface BridgeController {
  start(source?: string): boolean;
  cancel(): boolean;
  haul(held: boolean): void;
  handleKey(event: { type?: string; key: string }): boolean;
  step(dt: number): void;
  dispose(): void;
  getState(): BridgeSnapshot;
}

export function isBridgeTrigger(entityId: string): boolean {
  return entityId.toLowerCase() === BRIDGE_ENTITY_ID;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function easeInOutCosine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createBridgeController(
  engine: BridgeEngine,
  options: { boatUrl?: string; autoTick?: boolean } = {},
): BridgeController {
  let mode: BridgeMode = "idle";
  let x = BRIDGE_PATH.approach.x;
  let y = BRIDGE_PATH.approach.y;
  let scale: number = BRIDGE_CARGO_SCALE.approach;
  let mast = 0;
  let progress = 0;
  let haulHeld = false;
  let disposed = false;
  let raf = 0;
  let lastNow = 0;
  let keydown: ((ev: KeyboardEvent) => void) | null = null;
  let keyup: ((ev: KeyboardEvent) => void) | null = null;

  const autoTick = options.autoTick ?? typeof requestAnimationFrame === "function";
  const boatUrl =
    options.boatUrl ?? `/contents/${engine.getScrollId() ?? "qingming-riverside"}/atlas/boat.webp`;

  const overlays = mountOverlays(engine.getUiLayer(), boatUrl);

  const snapshot = (): BridgeSnapshot => ({
    mode,
    x,
    y,
    scale,
    mast,
    progress,
    haul: haulHeld,
    occluded: mode === "under" || mode === "done",
    disposed,
  });

  const active = (): boolean => mode !== "idle";

  const stopTick = (): void => {
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
    lastNow = 0;
  };

  const resetPose = (): void => {
    mode = "idle";
    progress = 0;
    mast = 0;
    haulHeld = false;
    scale = BRIDGE_CARGO_SCALE.approach;
    x = BRIDGE_PATH.approach.x;
    y = BRIDGE_PATH.approach.y;
  };

  const syncOverlay = (): void => {
    if (!overlays) return;
    const vp = engine.getViewport();
    overlays.root.hidden = !active();
    overlays.start.hidden = mode !== "idle";
    overlays.haul.hidden = mode !== "mast" && mode !== "under";
    overlays.status.textContent = STAGE_COPY[mode];
    overlays.haul.classList.toggle("is-held", haulHeld);
    overlays.occluder.classList.toggle("is-active", snapshot().occluded);

    const occ = worldToScreen(vp, BRIDGE_OCCLUDER.x, BRIDGE_OCCLUDER.y);
    overlays.occluder.style.left = `${occ.x}px`;
    overlays.occluder.style.top = `${occ.y}px`;
    overlays.occluder.style.width = `${BRIDGE_OCCLUDER.w * vp.zoom}px`;
    overlays.occluder.style.height = `${BRIDGE_OCCLUDER.h * vp.zoom}px`;

    const w = BOAT_SPRITE.width * scale * vp.zoom;
    const h = BOAT_SPRITE.height * scale * vp.zoom;
    const left = x - BOAT_SPRITE.anchorX * scale;
    const top = y - BOAT_SPRITE.anchorY * scale;
    const screen = worldToScreen(vp, left, top);
    overlays.cargo.style.left = `${screen.x}px`;
    overlays.cargo.style.top = `${screen.y}px`;
    overlays.cargo.style.width = `${w}px`;
    overlays.cargo.style.height = `${h}px`;
    overlays.cargo.style.zIndex = snapshot().occluded ? "2" : "4";
    overlays.mast.style.transform = `rotate(${mast * 82}deg)`;

    const apex = worldToScreen(vp, BRIDGE_APEX.x, BRIDGE_APEX.y);
    const mastBase = worldToScreen(vp, x, y - 8 * scale);
    overlays.rope.setAttribute("x1", String(apex.x));
    overlays.rope.setAttribute("y1", String(apex.y));
    overlays.rope.setAttribute("x2", String(mastBase.x));
    overlays.rope.setAttribute("y2", String(mastBase.y));
    overlays.rope.style.opacity = mode === "mast" || mode === "under" ? (haulHeld ? "0.95" : "0.45") : "0";
  };

  const releaseScheduler = (): void => {
    engine.scheduler.releaseContinuous(BRIDGE_CONTINUOUS_REASON);
    engine.scheduler.requestFrame();
  };

  const enter = (next: BridgeMode): void => {
    mode = next;
    progress = 0;
    if (next === "idle" || next === "done") haulHeld = false;
    if (next === "idle") releaseScheduler();
  };

  const rate = (): number => (haulHeld && (mode === "mast" || mode === "under") ? HAUL_BOOST : 1);

  const poseForMode = (): void => {
    if (mode === "approaching") {
      const e = easeInOutCosine(progress);
      x = lerp(BRIDGE_PATH.approach.x, BRIDGE_PATH.mastStart.x, e);
      y = lerp(BRIDGE_PATH.approach.y, BRIDGE_PATH.mastStart.y, e);
      scale = BRIDGE_CARGO_SCALE.approach;
      mast = 0;
    } else if (mode === "mast") {
      const e = easeInOutCosine(progress);
      x = lerp(BRIDGE_PATH.mastStart.x, BRIDGE_PATH.mastEnd.x, e);
      y = lerp(BRIDGE_PATH.mastStart.y, BRIDGE_PATH.mastEnd.y, e);
      scale = lerp(BRIDGE_CARGO_SCALE.approach, BRIDGE_CARGO_SCALE.mast, e);
      mast = e;
    } else if (mode === "under" || mode === "done") {
      const e = mode === "done" ? 1 : easeInOutCosine(progress);
      x = lerp(BRIDGE_PATH.mastEnd.x, BRIDGE_PATH.underEnd.x, e);
      y = lerp(BRIDGE_PATH.mastEnd.y, BRIDGE_PATH.underEnd.y, e);
      scale = lerp(BRIDGE_CARGO_SCALE.mast, BRIDGE_CARGO_SCALE.under, e);
      mast = 1;
    }
  };

  const step = (dt: number): void => {
    if (disposed || dt <= 0) {
      syncOverlay();
      return;
    }
    if (mode === "approaching") {
      progress = clamp01(progress + dt / APPROACH_SECONDS);
      poseForMode();
      if (progress >= 1) enter("mast");
    } else if (mode === "mast") {
      progress = clamp01(progress + (dt / MAST_SECONDS) * rate());
      poseForMode();
      if (progress >= 1) enter("under");
    } else if (mode === "under") {
      progress = clamp01(progress + (dt / UNDER_SECONDS) * rate());
      poseForMode();
      if (progress >= 1) enter("done");
    } else if (mode === "done") {
      progress = clamp01(progress + dt / DONE_SECONDS);
      poseForMode();
      if (progress >= 1) {
        resetPose();
        releaseScheduler();
      }
    }
    if (active()) engine.scheduler.requestFrame();
    syncOverlay();
  };

  const tick = (now: number): void => {
    raf = 0;
    if (disposed) return;
    if (!lastNow) lastNow = now;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    step(dt);
    if (!disposed && (active() || overlays)) {
      raf = requestAnimationFrame(tick);
    }
  };

  const ensureTick = (): void => {
    if (!autoTick || disposed || raf) return;
    lastNow = 0;
    raf = requestAnimationFrame(tick);
  };

  const start = (_source?: string): boolean => {
    if (disposed) return false;
    if (mode !== "idle" && mode !== "done") return false;
    resetPose();
    mode = "approaching";
    progress = 0;
    engine.camera.flyTo({
      centerX: CHAPTERS.bridge.centerX,
      centerY: CHAPTERS.bridge.centerY,
      zoom: CHAPTERS.bridge.zoom,
      duration: 800,
    });
    engine.scheduler.requestContinuous(BRIDGE_CONTINUOUS_REASON);
    engine.scheduler.requestFrame();
    ensureTick();
    syncOverlay();
    return true;
  };

  const cancel = (): boolean => {
    if (disposed || !active()) return false;
    resetPose();
    releaseScheduler();
    stopTick();
    ensureTick();
    syncOverlay();
    return true;
  };

  const haul = (held: boolean): void => {
    if (disposed) return;
    if (held && mode !== "mast" && mode !== "under") {
      haulHeld = false;
      return;
    }
    haulHeld = held;
    syncOverlay();
  };

  const handleKey = (event: { type?: string; key: string }): boolean => {
    if (disposed) return false;
    if (event.key === "Escape") {
      return cancel();
    }
    const haulKey = event.key === "ArrowLeft" || event.key === "e" || event.key === "E";
    if (!haulKey) return false;
    if (event.type === "keyup") {
      haul(false);
      return true;
    }
    haul(true);
    return mode === "mast" || mode === "under";
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mode = "idle";
    haulHeld = false;
    stopTick();
    releaseScheduler();
    if (typeof document !== "undefined") {
      if (keydown) document.removeEventListener("keydown", keydown);
      if (keyup) document.removeEventListener("keyup", keyup);
    }
    keydown = null;
    keyup = null;
    overlays?.root.remove();
    overlays?.start.remove();
  };

  if (typeof document !== "undefined") {
    keydown = (ev) => {
      handleKey({ type: "keydown", key: ev.key });
    };
    keyup = (ev) => {
      handleKey({ type: "keyup", key: ev.key });
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
  }

  if (overlays) {
    overlays.start.addEventListener("click", () => {
      start("ui");
    });
    overlays.haul.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      haul(true);
    });
    overlays.haul.addEventListener("pointerup", () => haul(false));
    overlays.haul.addEventListener("pointerleave", () => haul(false));
    overlays.haul.addEventListener("pointercancel", () => haul(false));
  }

  syncOverlay();
  ensureTick();

  return { start, cancel, haul, handleKey, step, dispose, getState: snapshot };
}

interface BridgeOverlays {
  root: HTMLElement;
  cargo: HTMLElement;
  mast: HTMLElement;
  occluder: HTMLElement;
  rope: SVGLineElement;
  hud: HTMLElement;
  status: HTMLElement;
  haul: HTMLButtonElement;
  start: HTMLButtonElement;
}

function mountOverlays(ui: HTMLElement | null | undefined, url: string): BridgeOverlays | null {
  if (!ui || typeof document === "undefined") return null;

  const start = document.createElement("button");
  start.type = "button";
  start.className = "qingming-bridge-start";
  start.textContent = "过船";
  start.setAttribute("aria-label", "开始虹桥过船");
  ui.appendChild(start);

  const root = document.createElement("div");
  root.className = "qingming-bridge-root";
  root.hidden = true;

  const cargo = document.createElement("div");
  cargo.className = "qingming-cargo";
  const hull = document.createElement("img");
  hull.className = "qingming-cargo__hull";
  hull.alt = "";
  hull.src = url;
  hull.setAttribute("aria-hidden", "true");
  hull.draggable = false;
  const mast = document.createElement("div");
  mast.className = "qingming-mast";
  mast.setAttribute("aria-hidden", "true");
  cargo.append(hull, mast);

  const occluder = document.createElement("div");
  occluder.className = "qingming-bridge-occluder";
  occluder.setAttribute("aria-hidden", "true");
  occluder.title = "Faked arch occlusion (DOM strip)";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "qingming-rope-svg");
  svg.setAttribute("aria-hidden", "true");
  const rope = document.createElementNS("http://www.w3.org/2000/svg", "line");
  rope.setAttribute("class", "qingming-rope");
  svg.appendChild(rope);

  const hud = document.createElement("div");
  hud.className = "qingming-bridge-hud";
  hud.setAttribute("role", "status");
  hud.setAttribute("aria-live", "polite");
  const status = document.createElement("p");
  status.className = "qingming-bridge-hud__status";
  const haul = document.createElement("button");
  haul.type = "button";
  haul.className = "qingming-bridge-hud__haul";
  haul.textContent = "牵绳";
  const hint = document.createElement("span");
  hint.className = "qingming-bridge-hud__hint";
  hint.textContent = "Esc 取消";
  hud.append(status, haul, hint);

  root.append(cargo, occluder, svg, hud);
  ui.appendChild(root);
  return { root, cargo, mast, occluder, rope, hud, status, haul, start };
}
