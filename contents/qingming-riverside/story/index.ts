import type { HitResult, ScrollEnginePublic } from "@handscroll/core";
import scene from "../scene.json";
import zh from "../i18n/zh-CN.json";
import { createFerryController } from "./events/ferry.ts";
import { createBridgeController, isBridgeTrigger } from "./events/bridge-quest.ts";
import { createAtmosphereController } from "./events/hud.ts";

type Copy = Record<string, string>;
const copy = zh as Copy;

const STYLE_ID = "qingming-riverside-story-css";
const STORY_CSS = `
.qingming-panel {
  position: absolute;
  right: 16px;
  top: 56px;
  z-index: 9;
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
  z-index: 8;
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
.qingming-bridge-hud {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 8;
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
.qingming-atmo {
  position: absolute;
  left: 16px;
  bottom: 62px;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: min(280px, calc(100% - 32px));
  pointer-events: none;
}
.qingming-atmo button {
  pointer-events: auto;
  border: 1px solid rgba(243, 230, 210, 0.45);
  background: rgba(18, 14, 11, 0.82);
  color: #f3e6d2;
  padding: 6px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.qingming-atmo button:hover { background: rgba(196, 120, 74, 0.9); }
.qingming-atmo button.is-on { background: rgba(196, 120, 74, 0.92); }
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
  const atmosphere = createAtmosphereController(engine);
  let panel: HTMLElement | null = null;

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
    const entity = scene.entities.find((e) => e.id === hit.entityId);
    if (entity && "action" in entity && entity.action?.type === "openPanel") {
      const key = "i18nKey" in entity && typeof entity.i18nKey === "string" ? entity.i18nKey : entity.id;
      openPanel(entity.action.payload as PanelPayload | undefined, key);
    }
  };

  const offs = [engine.events.on("entity:click", onEntityClick)];
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Escape") return;
    closePanel();
  };
  if (typeof document !== "undefined") document.addEventListener("keydown", onKey);

  const onUnload = (): void => {
    if (typeof document !== "undefined") document.removeEventListener("keydown", onKey);
    ferry.dispose();
    bridge.dispose();
    atmosphere.dispose();
    closePanel();
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
