import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EventBus, TriggerRuntime } from "@handscroll/core";
import type { SceneDocument, ViewportState } from "@handscroll/core";
import { WorldRuntime } from "@handscroll/world";
import { createCrowdPlugin } from "@handscroll/plugins";
import { createVesselPlugin } from "@handscroll/plugins";
import { STREET_PATHS, SHOPS } from "./coords.ts";
import sceneJson from "../scene.json";
import metaJson from "../meta.json";

const storyDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const WORLD_CLASS = /qingming-walker|qingming-shop|qingming-boat|qingming-night|qingming-bridge-occluder|qingming-cargo|qingming-pin/;

function viewport(centerX: number, centerY = 400, zoom = 1): ViewportState {
  return { centerX, centerY, zoom, screenWidth: 900, screenHeight: 700 };
}

describe("qingming phase 2 migration", () => {
  it("keeps authored street and shop points on the scene paths (Q2-M-01 data)", () => {
    const scene = sceneJson;
    const byId = new Map(scene.paths.map((path) => [path.id, path.points]));
    expect(byId.get("street-teahouse")).toEqual(STREET_PATHS.teahouse.map((point) => ({ x: point.x, y: point.y })));
    expect(byId.get("street-bridge")).toEqual(STREET_PATHS.bridge.map((point) => ({ x: point.x, y: point.y })));
    expect(byId.get("street-gate")).toEqual(STREET_PATHS.gate.map((point) => ({ x: point.x, y: point.y })));
    const shops = new Map(scene.actors.filter((actor) => actor.kind === "label").map((actor) => [actor.id, actor]));
    expect(shops.get("shop-teahouse")).toMatchObject({ x: SHOPS.teahouse.x, y: SHOPS.teahouse.y });
    expect(shops.get("shop-teahouse")?.label?.cycleSeconds).toBe(2.8);
    expect(shops.get("shop-bridge")?.label?.cycleSeconds).toBe(2.8);
    expect(shops.get("shop-gate")?.label?.cycleSeconds).toBe(2.8);
    expect(scene.spawns.map((spawn) => spawn.count).reduce((sum, count) => sum + count, 0)).toBe(8);
  });

  it("does not create world DOM actors or a private animation frame (Q2-M-08)", () => {
    const files = walk(storyDir).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith("coords.ts"));
    const hits: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      if (WORLD_CLASS.test(src) || src.includes("requestAnimationFrame") || src.includes("worldToScreen")) {
        hits.push(path.relative(storyDir, file));
      }
    }
    expect(hits).toEqual([]);
    expect(fs.existsSync(path.join(storyDir, "events/street-life.ts"))).toBe(false);
  });

  it("leaves spawns uninstantiated until crowd is enabled (G-I-01)", () => {
    const world = new WorldRuntime();
    world.load(sceneJson as SceneDocument);
    expect(world.snapshots().some((actor) => actor.id.startsWith("crowd-"))).toBe(false);
    world.setSpawnsEnabled(true);
    expect(world.snapshots().filter((actor) => actor.id.startsWith("crowd-teahouse:")).length).toBe(3);
    expect(world.snapshots().filter((actor) => actor.id.startsWith("crowd-gate:")).length).toBe(2);
    world.clear();
    expect(world.snapshots()).toEqual([]);
  });

  it("simulates tea-market walkers in view and holds them at the watermill (Q2-M-03)", () => {
    const world = new WorldRuntime();
    world.load(sceneJson as SceneDocument, { activeMargin: 320 });
    world.setSpawnsEnabled(true);
    const tea = viewport(sceneJson.chapters.find((chapter) => chapter.id === "teahouse")!.centerX, 400, 1.2);
    world.update(0, tea);
    const before = world.getActorPosition("crowd-teahouse:0");
    world.update(0.5, tea);
    const after = world.getActorPosition("crowd-teahouse:0");
    expect(before && after && Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0);
    expect(world.snapshots().find((actor) => actor.id === "shop-teahouse")?.visible).toBe(true);

    const mill = viewport(sceneJson.chapters.find((chapter) => chapter.id === "watermill")!.centerX, 400, 1.15);
    world.update(0, mill);
    const parked = world.getActorPosition("crowd-teahouse:0");
    world.update(1, mill);
    expect(world.getActorPosition("crowd-teahouse:0")).toEqual(parked);
    expect(world.snapshots().find((actor) => actor.id === "crowd-teahouse:0")?.visible).toBe(false);
  });

  it("moves the ferry hull along the berth path in world units (Q2-M-06)", () => {
    const world = new WorldRuntime();
    const events = new EventBus();
    world.load(sceneJson as SceneDocument);
    const plugin = createVesselPlugin({});
    const arrivals: unknown[] = [];
    events.on("vessel:arrived", (payload) => arrivals.push(payload));
    const near = viewport(3500, 556, 1);
    void plugin.onRegister?.({
      engine: {
        events,
        camera: { getState: () => near, flyTo: () => {}, interruptTransition: () => {} },
        scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
        getViewport: () => near,
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
      scene: sceneJson as SceneDocument,
      quality: "auto",
      world,
    });
    const east = world.getActorPosition("ferry");
    expect(east?.x).toBeGreaterThan(4000);
    events.emit("vessel:summon", {
      actorId: "ferry",
      pathId: "ferry-lane",
      fromDistance: 1455.5497,
      toDistance: 0,
      speed: 400,
    });
    let guard = 0;
    while (arrivals.length === 0 && guard++ < 40) {
      world.update(0.5, near);
      plugin.onFrame?.(0.5, near);
    }
    expect(arrivals).toEqual([{ actorId: "ferry", pathId: "ferry-lane" }]);
    expect(world.getActorPosition("ferry")?.x).toBeCloseTo(2802, 0);
    world.update(1, near);
    plugin.onFrame?.(1, near);
    expect(arrivals).toHaveLength(1);
  });

  it("maps dock clicks to dock:request and keeps crowd text in the pack config", () => {
    const events = new EventBus();
    const runtime = new TriggerRuntime(events);
    events.on("entity:click", (payload) => runtime.onEntityClick(payload));
    runtime.load((sceneJson as SceneDocument).triggers ?? []);
    const requests: unknown[] = [];
    events.on("dock:request", (payload) => requests.push(payload));
    events.emit("entity:click", { entityId: "dock-east" });
    expect(requests).toEqual([{ berth: "east" }]);
    expect(metaJson.pluginConfig.crowd.text["shop.teahouse"]).toBe("茶肆");
    expect(metaJson.plugins).toContain("crowd");
    expect(createCrowdPlugin).toBeTypeOf("function");
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
