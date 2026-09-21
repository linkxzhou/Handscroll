/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import { createGuidePlugin } from "./GuidePlugin.ts";
import type { EngineContext, SceneDocument } from "@handscroll/core";

function ctx(ui: HTMLElement): EngineContext {
  const events = new EventBus();
  return {
    engine: {
      events,
      camera: {
        getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
        flyTo: () => {},
        interruptTransition: () => {},
      },
      scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
      plugins: { use() {}, listIds: () => [] },
      on: (event, handler) => events.on(event, handler),
      getViewport: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
      setQuality: () => {},
      getQuality: () => "auto",
      getCachePolicy: () => ({
        gpuBudgetBytes: 1,
        decodedBudgetBytes: 1,
        maxConcurrentRequests: 1,
        maxUploadsPerFrame: 1,
      }),
      setCachePolicy: () => {},
      getContainer: () => ui,
      getUiLayer: () => ui,
      getDpr: () => 1,
      getScrollId: () => "demo-scroll",
      getScene: () => null,
    },
    scene: null,
    quality: "auto",
  };
}

const emptyScene = (id: string, chapters: SceneDocument["chapters"]): SceneDocument => ({
  version: 1,
  meta: { id, width: 100, height: 50 },
  background: { manifestUrl: "./tiles/manifest.json" },
  entities: [],
  chapters,
});

describe("GuidePlugin", () => {
  it("rebuilds chapter dots on scene load and clears them on unload (P-U-06)", async () => {
    const ui = document.createElement("div");
    const plugin = createGuidePlugin({ showChapterDots: true });
    const context = ctx(ui);
    plugin.onRegister?.(context);
    await plugin.onSceneLoad?.(emptyScene("a", []));
    expect(ui.querySelectorAll(".guide-rail__dot")).toHaveLength(0);

    await plugin.onSceneLoad?.(
      emptyScene("a", [{ id: "bridge", title: "Bridge", centerX: 1, centerY: 1, zoom: 1 }]),
    );
    expect(ui.querySelector(".guide-rail__dot")?.textContent).toBe("Bridge");

    await plugin.onSceneUnload?.();
    expect(ui.querySelectorAll(".guide-rail__dot")).toHaveLength(0);
    expect((ui.querySelector(".story-panel") as HTMLElement).hidden).toBe(true);

    context.engine.events.emit("panel:open", { title: "City gate", body: "Hello" });
    const panel = ui.querySelector(".story-panel") as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(ui.querySelector(".story-panel__title")?.textContent).toBe("City gate");

    await plugin.onDestroy?.();
    expect(ui.querySelector(".guide-rail")).toBeNull();
    expect(ui.querySelector(".story-panel")).toBeNull();
  });
});
