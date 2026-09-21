import type { HitResult, ScrollEnginePublic } from "@handscroll/core";
import scene from "../scene.json";
import zh from "../i18n/zh-CN.json";
import { createFerryController } from "./events/ferry.ts";
import { createBridgeController, isBridgeTrigger } from "./events/bridge.ts";
import { worldToScreen } from "./coords.ts";

type Copy = Record<string, string>;
const copy = zh as Copy;

const STYLE_ID = "qingming-riverside-story-css";
const STORY_CSS = `
.qingming-boat {
  position: absolute;
  pointer-events: none;
  object-fit: contain;
  user-select: none;
  z-index: 3;
}
.qingming-pin {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, -100%);
  pointer-events: auto;
  border: 1px solid rgba(243, 230, 210, 0.45);
  background: rgba(18, 14, 11, 0.82);
  color: #f3e6d2;
  padding: 4px 8px;
  border-radius: 999px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.qingming-pin:hover { background: rgba(196, 120, 74, 0.9); }
.qingming-panel {
  position: absolute;
  right: 16px;
  top: 56px;
  z-index: 5;
  width: min(320px, calc(100% - 32px));
  pointer-events: auto;
  background: rgba(18, 14, 11, 0.92);
  color: #f3e6d2;
  border: 1px solid rgba(243, 230, 210, 0.25);
  border-radius: 10px;
  padding: 12px 14px 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}
.qingming-panel h2 { margin: 0 28px 8px 0; font-size: 16px; font-weight: 600; }
.qingming-panel p { margin: 0; line-height: 1.55; font-size: 13px; opacity: 0.92; }
.qingming-panel__close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
}
.qingming-panel__action {
  margin-top: 12px;
  pointer-events: auto;
  border: 1px solid rgba(243, 230, 210, 0.45);
  background: rgba(196, 120, 74, 0.9);
  color: #f3e6d2;
  padding: 6px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.qingming-bridge-start {
  position: absolute;
  left: 16px;
  bottom: 18px;
  z-index: 6;
  pointer-events: auto;
  border: 1px solid rgba(243, 230, 210, 0.45);
  background: rgba(18, 14, 11, 0.82);
  color: #f3e6d2;
  padding: 8px 14px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.qingming-bridge-start:hover { background: rgba(196, 120, 74, 0.9); }
.qingming-bridge-root { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.qingming-cargo {
  position: absolute;
  pointer-events: none;
  z-index: 4;
}
.qingming-cargo__hull {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}
.qingming-mast {
  position: absolute;
  left: 46%;
  bottom: 42%;
  width: 4px;
  height: 72%;
  margin-left: -2px;
  transform-origin: 50% 100%;
  background: linear-gradient(180deg, #cbb496, #5c4633);
  border-radius: 1px;
  pointer-events: none;
}
.qingming-bridge-occluder {
  position: absolute;
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  background: linear-gradient(180deg, rgba(48, 36, 26, 0.12), rgba(22, 16, 12, 0.88));
  border-bottom: 2px solid rgba(90, 68, 48, 0.35);
  clip-path: polygon(0% 45%, 12% 12%, 50% 0%, 88% 12%, 100% 45%, 100% 100%, 0% 100%);
  transition: opacity 0.25s ease;
}
.qingming-bridge-occluder.is-active { opacity: 0.92; }
.qingming-rope-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 5;
}
.qingming-rope {
  stroke: #6b5340;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.qingming-bridge-hud {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 6;
  pointer-events: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
  max-width: min(420px, calc(100% - 32px));
  padding: 8px 12px;
  background: rgba(18, 14, 11, 0.88);
  border: 1px solid rgba(243, 230, 210, 0.22);
  border-radius: 10px;
  color: #f3e6d2;
}
.qingming-bridge-hud__status { margin: 0; font-size: 13px; line-height: 1.4; }
.qingming-bridge-hud__haul {
  pointer-events: auto;
  border: 1px solid rgba(243, 230, 210, 0.45);
  background: rgba(196, 120, 74, 0.85);
  color: inherit;
  padding: 6px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.qingming-bridge-hud__haul.is-held { background: rgba(168, 92, 48, 0.95); }
.qingming-bridge-hud__hint { font-size: 12px; opacity: 0.75; }
`;

interface PanelPayload {
  titleKey?: string;
  bodyKey?: string;
  title?: string;
  body?: string;
}

export function registerStory(engine: ScrollEnginePublic): () => void {
  ensureStyles();
  const ferry = createFerryController(engine);
  const bridge = createBridgeController(engine);
  const pins = mountPins(engine);
  let panel: HTMLElement | null = null;
  let pinRaf = 0;

  const layoutPins = (): void => {
    const vp = engine.getViewport();
    for (const pin of pins) {
      const screen = worldToScreen(vp, pin.x, pin.y);
      pin.el.style.left = `${screen.x}px`;
      pin.el.style.top = `${screen.y}px`;
    }
  };

  const tickPins = (): void => {
    pinRaf = 0;
    layoutPins();
    if (typeof requestAnimationFrame === "function") pinRaf = requestAnimationFrame(tickPins);
  };
  layoutPins();
  if (typeof requestAnimationFrame === "function") pinRaf = requestAnimationFrame(tickPins);

  const closePanel = (): void => {
    panel?.remove();
    panel = null;
  };

  const openPanel = (payload: PanelPayload | undefined, fallbackId: string): void => {
    if (typeof document === "undefined") return;
    closePanel();
    const title = resolveCopy(payload?.titleKey) ?? payload?.title ?? resolveCopy(`${fallbackId}.title`) ?? fallbackId;
    const body = resolveCopy(payload?.bodyKey) ?? payload?.body ?? resolveCopy(`${fallbackId}.body`) ?? "";
    const el = document.createElement("aside");
    el.className = "qingming-panel";
    el.setAttribute("role", "dialog");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = body;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "qingming-panel__close";
    close.setAttribute("aria-label", "关闭");
    close.textContent = "×";
    close.addEventListener("click", closePanel);
    el.append(close, heading, text);
    if (fallbackId === "hotspot.bridge" || fallbackId === "hotspot-bridge") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "qingming-panel__action";
      action.textContent = resolveCopy("bridge.startPanel") ?? "开始过船";
      action.addEventListener("click", () => {
        closePanel();
        bridge.start("panel");
      });
      el.append(action);
    }
    engine.getUiLayer().appendChild(el);
    panel = el;
  };

  const onEntityClick = (payload: unknown): void => {
    const hit = asHit(payload);
    if (!hit) return;
    if (isBridgeTrigger(hit.entityId)) {
      closePanel();
      bridge.start("hotspot");
      return;
    }
    if (hit.entityId.startsWith("dock-")) ferry.summon(hit.entityId);
    const entity = scene.entities.find((e) => e.id === hit.entityId);
    if (entity && "action" in entity && entity.action?.type === "openPanel") {
      const key = "i18nKey" in entity && typeof entity.i18nKey === "string" ? entity.i18nKey : entity.id;
      openPanel(entity.action.payload as PanelPayload | undefined, key);
    }
  };

  const onPinClick = (entityId: string): void => {
    onEntityClick({ entityId, renderer: "dom", interactionPriority: 1, worldX: 0, worldY: 0 } satisfies HitResult);
  };

  for (const pin of pins) {
    pin.el.addEventListener("click", () => onPinClick(pin.id));
  }

  const offs = [engine.events.on("entity:click", onEntityClick)];
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Escape") return;
    closePanel();
  };
  if (typeof document !== "undefined") document.addEventListener("keydown", onKey);

  const onUnload = (): void => {
    if (pinRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(pinRaf);
    pinRaf = 0;
    if (typeof document !== "undefined") document.removeEventListener("keydown", onKey);
    ferry.dispose();
    bridge.dispose();
    closePanel();
    for (const pin of pins) pin.el.remove();
    if (typeof document !== "undefined") document.getElementById(STYLE_ID)?.remove();
    offs.forEach((off) => off());
  };

  offs.push(engine.events.on("scene:unload", onUnload));
  return onUnload;
}

function resolveCopy(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return copy[key];
}

function asHit(payload: unknown): HitResult | null {
  if (!payload || typeof payload !== "object") return null;
  if (!("entityId" in payload) || typeof (payload as { entityId: unknown }).entityId !== "string") return null;
  return payload as HitResult;
}

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STORY_CSS;
  document.head.appendChild(style);
}

function mountPins(engine: ScrollEnginePublic): { id: string; x: number; y: number; el: HTMLButtonElement }[] {
  const ui = engine.getUiLayer();
  if (!ui || typeof document === "undefined") return [];
  const pins: { id: string; x: number; y: number; el: HTMLButtonElement }[] = [];
  for (const entity of scene.entities) {
    if (entity.type !== "hotspot") continue;
    const shape = entity.shape;
    if (!shape) continue;
    const cx = entity.x + (shape.kind === "rect" ? shape.w / 2 : 0);
    const cy = entity.y + (shape.kind === "rect" ? shape.h / 2 : 0);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "qingming-pin";
    const key = entity.i18nKey ? `${entity.i18nKey}.title` : entity.id;
    el.textContent = copy[key] ?? entity.id;
    ui.appendChild(el);
    pins.push({ id: entity.id, x: cx, y: cy, el });
  }
  return pins;
}
