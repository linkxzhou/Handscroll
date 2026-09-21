import { describe, expect, it } from "vitest";
import type { ScrollEnginePublic } from "@handscroll/core";
import { EventBus } from "@handscroll/core";
import { registerStory } from "./index.ts";
import { FERRY_CONTINUOUS_REASON } from "./events/ferry.ts";

function mockEngine(): ScrollEnginePublic & { continuous: Set<string> } {
  const events = new EventBus();
  const continuous = new Set<string>();
  return {
    events,
    continuous,
    camera: {
      getState: () => ({ centerX: 3258, centerY: 362, zoom: 1, screenWidth: 800, screenHeight: 600 }),
      flyTo: () => {},
      interruptTransition: () => {},
    },
    scheduler: {
      requestFrame: () => {},
      wake: () => {},
      requestContinuous: (reason: string) => {
        continuous.add(reason);
      },
      releaseContinuous: (reason: string) => {
        continuous.delete(reason);
      },
    },
    getViewport: () => ({ centerX: 3258, centerY: 362, zoom: 1, screenWidth: 800, screenHeight: 600 }),
    setQuality: () => {},
    getQuality: () => "auto",
    getCachePolicy: () => ({
      gpuBudgetBytes: 1,
      decodedBudgetBytes: 1,
      maxConcurrentRequests: 1,
      maxUploadsPerFrame: 1,
    }),
    setCachePolicy: () => {},
    getContainer: () => ({}) as HTMLElement,
    getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
    getDpr: () => 1,
    getScrollId: () => "qingming-riverside",
  };
}

describe("qingming registerStory pack load", () => {
  it("registers, summons on dock click, and cleans up on unload", () => {
    const engine = mockEngine();
    const cleanup = registerStory(engine);
    engine.events.emit("entity:click", { entityId: "dock-west", renderer: "pixi", interactionPriority: 1, worldX: 0, worldY: 0 });
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(true);
    cleanup();
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(false);
    engine.continuous.clear();
    engine.events.emit("entity:click", { entityId: "dock-west", renderer: "pixi", interactionPriority: 1, worldX: 0, worldY: 0 });
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(false);
    expect(() => cleanup()).not.toThrow();
  });
});
