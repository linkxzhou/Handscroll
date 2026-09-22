import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext, SceneDocument, ViewportState } from "@handscroll/core";
import { WorldRuntime } from "@handscroll/world";
import { createCrowdPlugin } from "./CrowdPlugin.ts";

function laneScene(seed: number): SceneDocument {
  return {
    version: 2,
    meta: { id: "fixture", width: 4000, height: 400 },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: [],
    chapters: [],
    paths: [
      {
        id: "lane",
        points: [
          { x: 0, y: 100 },
          { x: 300, y: 100 },
        ],
      },
      {
        id: "far",
        points: [
          { x: 3000, y: 100 },
          { x: 3400, y: 100 },
        ],
      },
    ],
    actors: [
      {
        id: "sign",
        kind: "label",
        x: 20,
        y: 80,
        width: 40,
        height: 16,
        label: { text: "one", cycleKeys: ["sign.a", "sign.b"], cycleSeconds: 1 },
      },
    ],
    zones: [],
    spawns: [
      {
        id: "crowd",
        pathId: "lane",
        count: 3,
        speedMin: 10,
        speedMax: 20,
        atlas: "./walker.png",
        frames: ["walk"],
        seed,
        width: 10,
        height: 20,
      },
      {
        id: "distant",
        pathId: "far",
        count: 2,
        speedMin: 10,
        speedMax: 12,
        atlas: "./walker.png",
        frames: ["walk"],
        seed,
        width: 10,
        height: 20,
      },
    ],
    dialogues: [],
    triggers: [],
  };
}

function ctx(world: WorldRuntime, scene: SceneDocument): EngineContext & { continuous: Set<string> } {
  const events = new EventBus();
  const continuous = new Set<string>();
  const vp: ViewportState = { centerX: 40, centerY: 100, zoom: 1, screenWidth: 200, screenHeight: 200 };
  return {
    continuous,
    world,
    scene,
    quality: "auto",
    engine: {
      events,
      camera: { getState: () => vp, flyTo: () => {}, interruptTransition: () => {} },
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
}

describe("crowd plugin", () => {
  it("reproduces initial distances from a fixed spawn seed (G-U-01)", () => {
    const first = new WorldRuntime();
    const second = new WorldRuntime();
    first.load(laneScene(7));
    second.load(laneScene(7));
    first.setSpawnsEnabled(true);
    second.setSpawnsEnabled(true);
    const ids = ["crowd:0", "crowd:1", "crowd:2"];
    for (const id of ids) {
      expect(first.getActorPosition(id)).toEqual(second.getActorPosition(id));
    }
    const other = new WorldRuntime();
    other.load(laneScene(8));
    other.setSpawnsEnabled(true);
    expect(other.getActorPosition("crowd:0")).not.toEqual(first.getActorPosition("crowd:0"));
  });

  it("does not advance spawn members outside the viewport (G-U-02)", () => {
    const world = new WorldRuntime();
    const scene = laneScene(3);
    world.load(scene);
    world.setSpawnsEnabled(true);
    const plugin = createCrowdPlugin({ enabled: true, text: { "sign.a": "One", "sign.b": "Two" } });
    const host = ctx(world, scene);
    void plugin.onRegister?.(host);
    void plugin.onSceneLoad?.(scene);
    const vp = host.engine.getViewport();
    world.update(0, vp);
    const parked = world.getActorPosition("distant:0");
    world.update(2, vp);
    plugin.onFrame?.(2, vp);
    expect(world.getActorPosition("distant:0")).toEqual(parked);
    const nearBefore = world.getActorPosition("crowd:0");
    world.update(0.4, vp);
    expect(world.getActorPosition("crowd:0")?.x).not.toBeCloseTo(nearBefore?.x ?? 0);
  });

  it("cycles label copy from config and skips spawns when disabled (G-I-01)", async () => {
    const world = new WorldRuntime();
    const scene = laneScene(1);
    world.load(scene);
    const disabled = createCrowdPlugin({ enabled: false });
    const host = ctx(world, scene);
    await disabled.onRegister?.(host);
    await disabled.onSceneLoad?.(scene);
    expect(world.snapshots().some((actor) => actor.id.startsWith("crowd:"))).toBe(false);

    const plugin = createCrowdPlugin({ enabled: true, text: { "sign.a": "One", "sign.b": "Two" } });
    await plugin.onRegister?.(host);
    await plugin.onSceneLoad?.(scene);
    expect(world.snapshots().filter((actor) => actor.id.startsWith("crowd:"))).toHaveLength(3);
    world.update(0, host.engine.getViewport());
    plugin.onFrame?.(0, host.engine.getViewport());
    expect(world.snapshots().find((actor) => actor.id === "sign")?.label).toBe("One");
    plugin.onFrame?.(1, host.engine.getViewport());
    expect(world.snapshots().find((actor) => actor.id === "sign")?.label).toBe("Two");
    await plugin.onSceneUnload?.();
    expect(world.snapshots().some((actor) => actor.id.startsWith("crowd:"))).toBe(false);
    world.clear();
    expect(world.snapshots()).toEqual([]);
  });
});
