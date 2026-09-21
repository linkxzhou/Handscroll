import type { EngineContext, PluginFactory, ScrollPlugin } from "@handscroll/core";

interface GuideConfig {
  showChapterDots?: boolean;
}

interface PanelPayload {
  title?: string;
  body?: string;
  entityId?: string;
}

export const createGuidePlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as GuideConfig;
  let rail: HTMLElement | null = null;
  let panel: HTMLElement | null = null;
  let titleEl: HTMLElement | null = null;
  let bodyEl: HTMLElement | null = null;
  let ctx: EngineContext | null = null;
  const offs: (() => void)[] = [];

  const hidePanel = () => {
    if (panel) panel.hidden = true;
  };

  const showPanel = (rawPayload: unknown) => {
    if (!panel || !titleEl || !bodyEl) return;
    const payload = (rawPayload ?? {}) as PanelPayload;
    titleEl.textContent = payload.title ?? payload.entityId ?? "Note";
    bodyEl.textContent = payload.body ?? "";
    bodyEl.hidden = !payload.body;
    panel.hidden = false;
  };

  return {
    id: "guide",
    priority: 10,
    onRegister(next) {
      ctx = next;
      rail = document.createElement("nav");
      rail.className = "guide-rail";
      rail.setAttribute("aria-label", "Chapters");
      rail.style.pointerEvents = "none";
      next.engine.getUiLayer().appendChild(rail);

      panel = document.createElement("aside");
      panel.className = "story-panel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "story-panel__close";
      close.setAttribute("aria-label", "Close");
      close.textContent = "×";
      close.addEventListener("click", hidePanel);
      titleEl = document.createElement("h2");
      titleEl.className = "story-panel__title";
      bodyEl = document.createElement("p");
      bodyEl.className = "story-panel__body";
      panel.append(close, titleEl, bodyEl);
      next.engine.getUiLayer().appendChild(panel);

      offs.push(next.engine.on("panel:open", showPanel));
      offs.push(next.engine.on("panel:close", hidePanel));
    },
    onSceneLoad(scene) {
      if (!rail) return;
      rail.replaceChildren();
      const chapters = scene.chapters ?? [];
      if (chapters.length === 0 || config.showChapterDots === false) return;
      const camera = ctx?.engine.camera;
      const scheduler = ctx?.engine.scheduler;
      if (!camera || !scheduler) return;
      for (const chapter of chapters) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "guide-rail__dot";
        btn.textContent = chapter.title ?? chapter.id;
        btn.style.pointerEvents = "auto";
        btn.addEventListener("click", () => {
          camera.flyTo({
            centerX: chapter.centerX,
            centerY: chapter.centerY,
            zoom: chapter.zoom,
            duration: 800,
          });
          scheduler.requestContinuous("camera");
          scheduler.requestFrame();
        });
        rail.appendChild(btn);
      }
    },
    onSceneUnload() {
      rail?.replaceChildren();
      hidePanel();
    },
    onDestroy() {
      for (const off of offs.splice(0, offs.length)) off();
      rail?.remove();
      panel?.remove();
      rail = null;
      panel = null;
      titleEl = null;
      bodyEl = null;
      ctx = null;
    },
  };
};
