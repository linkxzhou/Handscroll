import type { EventBusLike, FlyToOptions, SchedulerLike } from "@handscroll/core";
import scene from "../../scene.json";
import zh from "../../i18n/zh-CN.json";
import { sceneStations } from "../paths.ts";

type Copy = Record<string, string>;
const copy = zh as Copy;

/**
 * 虹桥过船 quest. Hull motion is a vessel actor; this module only sequences
 * stages, the haul boost, the occluder, and the HUD.
 */
export type BridgeMode = "idle" | "approaching" | "mast" | "under" | "done";

export const BRIDGE_ENTITY_ID = "bridge-event";
export const CARGO_ACTOR_ID = "cargo";
export const CARGO_PATH_ID = "bridge-cargo";
export const OCCLUDER_ACTOR_ID = "bridge-occluder";
export const APPROACH_SECONDS = 4;
export const MAST_SECONDS = 3.5;
export const UNDER_SECONDS = 4;
export const DONE_SECONDS = 2;
export const HAUL_BOOST = 1.75;
export const OCCLUDER_ALPHA = 0.72;

export function legSpeed(distance: number, seconds: number, haul: boolean): number {
  if (seconds <= 0) return 0;
  return (Math.max(0, distance) / seconds) * (haul ? HAUL_BOOST : 1);
}

export interface BridgeSnapshot {
  mode: BridgeMode;
  mast: number;
  haul: boolean;
  occluded: boolean;
  disposed: boolean;
}

export interface BridgeEngine {
  events: EventBusLike;
  scheduler: SchedulerLike;
  camera: { flyTo(opts: FlyToOptions): void };
  getUiLayer(): HTMLElement;
}

export interface BridgeController {
  start(source?: string): boolean;
  cancel(): boolean;
  haul(held: boolean): void;
  handleKey(event: { type?: string; key: string }): boolean;
  /** Advances the post-arrival hold. Movement itself is the vessel plugin. */
  step(dt: number): void;
  dispose(): void;
  getState(): BridgeSnapshot;
}

export function isBridgeTrigger(entityId: string): boolean {
  return entityId.toLowerCase() === BRIDGE_ENTITY_ID;
}

interface Leg {
  from: number;
  to: number;
  seconds: number;
}

export function createBridgeController(
  engine: BridgeEngine,
  options: { timer?: boolean } = {},
): BridgeController {
  const stations = sceneStations(CARGO_PATH_ID);
  const approachEnd = stations[1] ?? 0;
  const mastEnd = stations[2] ?? approachEnd;
  const underEnd = stations[3] ?? mastEnd;
  const useTimer = options.timer ?? true;

  let mode: BridgeMode = "idle";
  let mast = 0;
  let haulHeld = false;
  let disposed = false;
  let leg: Leg | null = null;
  let hold = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const offs: Array<() => void> = [];

  const overlays = mountHud(engine.getUiLayer());

  const snapshot = (): BridgeSnapshot => ({
    mode,
    mast,
    haul: haulHeld,
    occluded: mode === "under" || mode === "done",
    disposed,
  });

  const syncHud = (): void => {
    if (!overlays) return;
    overlays.root.hidden = mode === "idle";
    overlays.start.hidden = mode !== "idle";
    overlays.haul.hidden = mode !== "mast" && mode !== "under";
    overlays.haul.classList.toggle("is-held", haulHeld);
    overlays.status.textContent = stageCopy(mode);
  };

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const emitLeg = (next: Leg, haul: boolean, fromCurrent: boolean): void => {
    leg = next;
    const distance = Math.abs(next.to - next.from);
    engine.events.emit("vessel:summon", {
      actorId: CARGO_ACTOR_ID,
      pathId: CARGO_PATH_ID,
      toDistance: next.to,
      speed: legSpeed(distance, next.seconds, haul),
      ...(fromCurrent ? {} : { fromDistance: next.from }),
    });
    engine.scheduler.requestFrame();
  };

  const setOccluder = (alpha: number): void => {
    engine.events.emit("actor:alpha", { id: OCCLUDER_ACTOR_ID, alpha });
  };

  const resetPose = (): void => {
    clearTimer();
    mode = "idle";
    mast = 0;
    haulHeld = false;
    hold = 0;
    leg = null;
    engine.events.emit("vessel:summon", {
      actorId: CARGO_ACTOR_ID,
      pathId: CARGO_PATH_ID,
      fromDistance: 0,
      toDistance: 0,
      speed: 0,
      quiet: true,
    });
    setOccluder(0);
    syncHud();
  };

  const finishHold = (): void => {
    if (disposed || mode !== "done") return;
    resetPose();
  };

  const enterDone = (): void => {
    mode = "done";
    mast = 1;
    haulHeld = false;
    hold = 0;
    leg = null;
    setOccluder(OCCLUDER_ALPHA);
    syncHud();
    if (useTimer) {
      clearTimer();
      timer = setTimeout(finishHold, DONE_SECONDS * 1000);
    }
  };

  const onArrived = (): void => {
    if (disposed) return;
    if (mode === "approaching") {
      mode = "mast";
      mast = 0;
      emitLeg({ from: approachEnd, to: mastEnd, seconds: MAST_SECONDS }, false, false);
      syncHud();
      return;
    }
    if (mode === "mast") {
      mode = "under";
      mast = 1;
      setOccluder(OCCLUDER_ALPHA);
      emitLeg({ from: mastEnd, to: underEnd, seconds: UNDER_SECONDS }, haulHeld, false);
      syncHud();
      return;
    }
    if (mode === "under") enterDone();
  };

  const start = (_source?: string): boolean => {
    if (disposed) return false;
    if (mode !== "idle" && mode !== "done") return false;
    clearTimer();
    mode = "approaching";
    mast = 0;
    haulHeld = false;
    hold = 0;
    const chapter = scene.chapters.find((item) => item.id === "bridge");
    engine.camera.flyTo({
      centerX: chapter?.centerX ?? 0,
      centerY: chapter?.centerY ?? 0,
      zoom: chapter?.zoom ?? 1,
      duration: 800,
    });
    setOccluder(0);
    emitLeg({ from: 0, to: approachEnd, seconds: APPROACH_SECONDS }, false, false);
    syncHud();
    return true;
  };

  const cancel = (): boolean => {
    if (disposed || mode === "idle") return false;
    resetPose();
    return true;
  };

  const haul = (held: boolean): void => {
    if (disposed) return;
    if (held && mode !== "mast" && mode !== "under") {
      haulHeld = false;
      syncHud();
      return;
    }
    haulHeld = held;
    if (leg && (mode === "mast" || mode === "under")) {
      emitLeg(leg, haulHeld, true);
    }
    syncHud();
  };

  const handleKey = (event: { type?: string; key: string }): boolean => {
    if (disposed) return false;
    if (event.key === "Escape") return cancel();
    const haulKey = event.key === "ArrowLeft" || event.key === "e" || event.key === "E";
    if (!haulKey) return false;
    if (event.type === "keyup") {
      haul(false);
      return true;
    }
    haul(true);
    return mode === "mast" || mode === "under";
  };

  const step = (dt: number): void => {
    if (disposed || mode !== "done" || dt <= 0) return;
    hold += dt;
    if (hold >= DONE_SECONDS) finishHold();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mode = "idle";
    haulHeld = false;
    clearTimer();
    for (const off of offs) off();
    offs.length = 0;
    overlays?.root.remove();
    overlays?.start.remove();
  };

  offs.push(
    engine.events.on("vessel:arrived", (payload) => {
      if (!payload || typeof payload !== "object") return;
      if ((payload as { actorId?: unknown }).actorId !== CARGO_ACTOR_ID) return;
      onArrived();
    }),
  );

  if (typeof document !== "undefined") {
    const onKeyDown = (ev: KeyboardEvent) => {
      handleKey({ type: "keydown", key: ev.key });
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      handleKey({ type: "keyup", key: ev.key });
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    offs.push(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });
  }

  if (overlays) {
    overlays.start.addEventListener("click", () => start("ui"));
    overlays.haul.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      haul(true);
    });
    overlays.haul.addEventListener("pointerup", () => haul(false));
    overlays.haul.addEventListener("pointerleave", () => haul(false));
    overlays.haul.addEventListener("pointercancel", () => haul(false));
  }

  syncHud();
  return { start, cancel, haul, handleKey, step, dispose, getState: snapshot };
}

function stageCopy(mode: BridgeMode): string {
  if (mode === "approaching") return copy["bridge.approaching"] ?? "货船正在靠近虹桥";
  if (mode === "mast") return copy["bridge.mast"] ?? "船工正在降桅。按住牵绳协助，或旁观等待。";
  if (mode === "under") return copy["bridge.under"] ?? "船正在过桥。继续牵绳或旁观。";
  if (mode === "done") return copy["bridge.done"] ?? "船已通过虹桥。";
  return copy["bridge.start"] ?? "过船";
}

interface BridgeHud {
  root: HTMLElement;
  status: HTMLElement;
  haul: HTMLButtonElement;
  start: HTMLButtonElement;
}

function mountHud(ui: HTMLElement | null | undefined): BridgeHud | null {
  if (!ui || typeof document === "undefined") return null;

  const start = document.createElement("button");
  start.type = "button";
  start.className = "qingming-bridge-start";
  start.textContent = copy["bridge.start"] ?? "过船";
  start.setAttribute("aria-label", "开始虹桥过船");
  ui.appendChild(start);

  const root = document.createElement("div");
  root.className = "qingming-bridge-hud";
  root.hidden = true;
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const status = document.createElement("p");
  status.className = "qingming-bridge-hud__status";
  const haul = document.createElement("button");
  haul.type = "button";
  haul.className = "qingming-bridge-hud__haul";
  haul.textContent = copy["bridge.haul"] ?? "牵绳";
  const hint = document.createElement("span");
  hint.className = "qingming-bridge-hud__hint";
  hint.textContent = "Esc 取消";
  root.append(status, haul, hint);
  ui.appendChild(root);
  return { root, status, haul, start };
}
