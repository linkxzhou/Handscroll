import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext, SceneDocument, ViewportState } from "@handscroll/core";
import { WorldRuntime } from "@handscroll/world";
import { createVesselPlugin } from "./VesselPlugin.ts";

function scene(): SceneDocument {
  return {
    version: 2,
    meta: { id: "fixture", width: 500, height: 200 },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: [],
    chapters: [],
    paths: [
      {
        id: "lane",
        points: [
          { x: 0, y: 40 },
          { x: 200, y: 40 },
        ],
      },
    ],
    actors: [
      {
        id: "boat",
        kind: "sprite",
        x: 0,
        y: 40,
        width: 20,
        height: 10,
        pathId: "lane",
        speed: 0,
        follow: "once",
        distance: 0,
      },
    ],
    zones: [],
    spawns: [],
    dialogues: [],
    triggers: [],
  };
}

describe("vessel plugin", () => {
  it("emits vessel:arrived exactly once when a summon finishes (G-U-03)", () => {
    const world = new WorldRuntime();
    const doc = scene();
    world.load(doc);
    const events = new EventBus();
    const arrivals: unknown[] = [];
    events.on("vessel:arrived", (payload) => arrivals.push(payload));
    const vp: ViewportState = { centerX: 40, centerY: 40, zoom: 1, screenWidth: 200, screenHeight: 120 };
    const ctx: EngineContext = {
      world,
      scene: doc,
      quality: "auto",
      engine: {
        events,
        camera: { getState: () => vp, flyTo: () => {}, interruptTransition: () => {} },
        scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
        getViewport: () => vp,
        setQuality: () => {},
        getQuality: () => "auto",
        getCachePolicy: () => ({ gpuBudgetBytes: 1, decodedBudgetBytes: 1, maxConcurrentRequests: 1, maxUploadsPerFrame: 1 }),
        setCachePolicy: () => {},
        getContainer: () => ({}) as HTMLElement,
        getUiLayer: () => ({}) as HTMLElement,
        getDpr: () => 1,
        getScrollId: () => null,
        ensureThree: async () => null,
      },
    };
    const plugin = createVesselPlugin({});
    void plugin.onRegister?.(ctx);
    events.emit("vessel:summon", { actorId: "boat", fromDistance: 0, toDistance: 100, speed: 50 });
    world.update(1, vp);
    plugin.onFrame?.(1, vp);
    expect(arrivals).toEqual([]);
    expect(world.getActorPosition("boat")?.x).toBeCloseTo(50);
    world.update(1, vp);
    plugin.onFrame?.(1, vp);
    world.update(1, vp);
    plugin.onFrame?.(1, vp);
    expect(arrivals).toEqual([{ actorId: "boat", pathId: "lane" }]);
    expect(world.getActorPosition("boat")?.x).toBeCloseTo(100);

    events.emit("vessel:pause", { actorId: "boat" });
    events.emit("vessel:summon", { actorId: "boat", fromDistance: 100, toDistance: 0, speed: 0, quiet: true });
    world.update(1, vp);
    plugin.onFrame?.(1, vp);
    expect(arrivals).toHaveLength(1);
    expect(world.getActorPosition("boat")?.x).toBeCloseTo(100);
  });
});
