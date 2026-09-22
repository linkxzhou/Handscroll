import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext, ViewportState } from "@handscroll/core";
import { createGuidePlugin } from "./GuidePlugin.ts";

class FakeEl {
  style: Record<string, string> = {};
  children: FakeEl[] = [];
  className = "";
  textContent = "";
  type = "";
  private listeners = new Map<string, Array<() => void>>();

  setAttribute(): void {}
  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  appendChild(child: FakeEl): FakeEl {
    this.children.push(child);
    return child;
  }
  replaceChildren(): void {
    this.children.length = 0;
  }
  remove(): void {}
  click(): void {
    for (const fn of this.listeners.get("click") ?? []) fn();
  }
}

describe("guide chapter arrival", () => {
  it("emits chapter:arrive when flyTo finishes or is interrupted", () => {
    const created: FakeEl[] = [];
    const previous = globalThis.document;
    globalThis.document = {
      createElement() {
        const el = new FakeEl();
        created.push(el);
        return el;
      },
    } as unknown as Document;
    try {
      const events = new EventBus();
      const arrived: { id?: string; completed?: boolean }[] = [];
      events.on("chapter:arrive", (payload) => {
        arrived.push(payload as { id?: string; completed?: boolean });
      });
      let animating = false;
      let state: ViewportState = { centerX: 0, centerY: 0, zoom: 1, screenWidth: 100, screenHeight: 100 };
      const ctx: EngineContext = {
        engine: {
          events,
          camera: {
            getState: () => state,
            flyTo: () => {
              animating = true;
            },
            interruptTransition: () => {
              animating = false;
            },
            isAnimating: () => animating,
          },
          scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
          getViewport: () => state,
          setQuality: () => {},
          getQuality: () => "auto",
          getCachePolicy: () => ({ gpuBudgetBytes: 1, decodedBudgetBytes: 1, maxConcurrentRequests: 1, maxUploadsPerFrame: 1 }),
          setCachePolicy: () => {},
          getContainer: () => ({}) as HTMLElement,
          getUiLayer: () => new FakeEl() as unknown as HTMLElement,
          getDpr: () => 1,
          getScrollId: () => null,
          ensureThree: async () => null,
        },
        scene: null,
        quality: "auto",
      };
      const plugin = createGuidePlugin({});
      void plugin.onRegister?.(ctx);
      void plugin.onSceneLoad?.({
        version: 1,
        meta: { id: "fixture", width: 10, height: 10 },
        background: { manifestUrl: "./tiles/manifest.json" },
        entities: [],
        chapters: [{ id: "gate", title: "Gate", centerX: 40, centerY: 10, zoom: 1.2 }],
      });
      plugin.onFrame?.(0.1, state);
      expect(arrived).toEqual([]);

      const rail = created[0];
      expect(rail).toBeDefined();
      rail!.children[0]!.click();
      plugin.onFrame?.(0.1, state);
      expect(arrived).toEqual([]);

      animating = false;
      state = { centerX: 4, centerY: 10, zoom: 1.2, screenWidth: 100, screenHeight: 100 };
      plugin.onFrame?.(0.1, state);
      expect(arrived).toEqual([{ id: "gate", completed: false }]);

      rail!.children[0]!.click();
      animating = false;
      state = { centerX: 40, centerY: 10, zoom: 1.2, screenWidth: 100, screenHeight: 100 };
      plugin.onFrame?.(0.1, state);
      expect(arrived).toEqual([
        { id: "gate", completed: false },
        { id: "gate", completed: true },
      ]);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(globalThis, "document");
      } else {
        globalThis.document = previous;
      }
    }
  });
});
