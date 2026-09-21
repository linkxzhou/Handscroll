import type { EngineContext, PluginFactory, ScrollPlugin } from "@handscroll/core";

interface GuideConfig {
  showChapterDots?: boolean;
}

export const createGuidePlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as GuideConfig;
  let rail: HTMLElement | null = null;
  let ctx: EngineContext | null = null;

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
    },
    onDestroy() {
      rail?.remove();
      rail = null;
      ctx = null;
    },
  };
};
