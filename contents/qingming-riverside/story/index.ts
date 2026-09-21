import type { HitResult, ScrollEnginePublic } from "@handscroll/core";
import scene from "../scene.json";
import zh from "../i18n/zh-CN.json";
import { createFerryController } from "./events/ferry.ts";
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
    engine.getUiLayer().appendChild(el);
    panel = el;
  };

  const onEntityClick = (payload: unknown): void => {
    const hit = asHit(payload);
    if (!hit) return;
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

  const onUnload = (): void => {
    if (pinRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(pinRaf);
    pinRaf = 0;
    ferry.dispose();
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
