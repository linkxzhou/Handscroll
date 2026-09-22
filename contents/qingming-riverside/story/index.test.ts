import { describe, expect, it } from "vitest";
import type { ScrollEnginePublic } from "@handscroll/core";
import { EventBus } from "@handscroll/core";
import { CARGO_ACTOR_ID } from "./events/bridge-quest.ts";
import { FERRY_ACTOR_ID } from "./events/ferry.ts";
import { registerStory } from "./index.ts";

function mockEngine(): ScrollEnginePublic {
  const events = new EventBus();
  return {
    events,
    camera: {
      getState: () => ({ centerX: 3258, centerY: 362, zoom: 1, screenWidth: 800, screenHeight: 600 }),
      flyTo: () => {},
      interruptTransition: () => {},
    },
    scheduler: {
      requestFrame: () => {},
      wake: () => {},
      requestContinuous: () => {},
      releaseContinuous: () => {},
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
    getUiLayer: () => ({ appendChild: (node: unknown) => node }) as HTMLElement,
    getDpr: () => 1,
    getScrollId: () => "qingming-riverside",
    ensureThree: async () => null,
  };
}

describe("qingming registerStory", () => {
  it("summons the ferry from a dock request and ignores clicks after cleanup", () => {
    const engine = mockEngine();
    const summons: string[] = [];
    engine.events.on("vessel:summon", (payload) => {
      if (payload && typeof payload === "object" && (payload as { actorId?: unknown }).actorId === FERRY_ACTOR_ID) {
        summons.push(FERRY_ACTOR_ID);
      }
    });
    const cleanup = registerStory(engine);
    engine.events.emit("dock:request", { berth: "west" });
    expect(summons).toEqual([FERRY_ACTOR_ID]);
    cleanup();
    engine.events.emit("dock:request", { berth: "east" });
    expect(summons).toEqual([FERRY_ACTOR_ID]);
    expect(() => cleanup()).not.toThrow();
  });

  it("starts the bridge quest from the bridge hotspot and disposes it", () => {
    const engine = mockEngine();
    const summons: string[] = [];
    engine.events.on("vessel:summon", (payload) => {
      if (payload && typeof payload === "object" && (payload as { actorId?: unknown }).actorId === CARGO_ACTOR_ID) {
        summons.push(CARGO_ACTOR_ID);
      }
    });
    const cleanup = registerStory(engine);
    engine.events.emit("entity:click", {
      entityId: "bridge-event",
      renderer: "pixi",
      interactionPriority: 1,
      worldX: 0,
      worldY: 0,
    });
    expect(summons.length).toBeGreaterThan(0);
    cleanup();
    const after = summons.length;
    engine.events.emit("entity:click", {
      entityId: "bridge-event",
      renderer: "pixi",
      interactionPriority: 1,
      worldX: 0,
      worldY: 0,
    });
    expect(summons.length).toBe(after);
    expect(() => cleanup()).not.toThrow();
  });
});
