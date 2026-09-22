import { describe, expect, it } from "vitest";
import type { SceneDocument, ViewportState } from "@handscroll/core";
import { EventBus, TimeService } from "@handscroll/core";
import { WorldRuntime } from "./WorldRuntime.ts";

function scene(): SceneDocument {
  return {
    version: 2,
    meta: { id: "fixture", width: 2000, height: 800 },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: [{ id: "mark", type: "hotspot", x: 10, y: 10, shape: { kind: "circle", r: 4 } }],
    chapters: [],
    paths: [
      {
        id: "lane",
        points: [
          { x: 0, y: 100 },
          { x: 400, y: 100 },
        ],
      },
      {
        id: "far-lane",
        points: [
          { x: 5000, y: 100 },
          { x: 5400, y: 100 },
        ],
      },
    ],
    actors: [
      {
        id: "walker",
        kind: "sprite",
        x: 0,
        y: 100,
        width: 20,
        height: 40,
        anchorX: 0.5,
        anchorY: 1,
        pathId: "lane",
        speed: 100,
        follow: "loop",
        distance: 0,
      },
      {
        id: "far",
        kind: "sprite",
        x: 5000,
        y: 100,
        width: 20,
        height: 40,
        anchorX: 0.5,
        anchorY: 1,
        pathId: "far-lane",
        speed: 100,
        follow: "loop",
        distance: 0,
      },
    ],
    zones: [],
    spawns: [],
    dialogues: [],
    triggers: [],
  };
}

function viewport(centerX: number): ViewportState {
  return { centerX, centerY: 100, zoom: 1, screenWidth: 200, screenHeight: 200 };
}

describe("WorldRuntime culling and pause", () => {
  it("hides an actor outside the cull rect and does not advance its distance (W-U-02)", () => {
    const world = new WorldRuntime();
    world.load(scene());
    world.update(1, viewport(0));
    const snaps = world.snapshots();
    const walker = snaps.find((actor) => actor.id === "walker");
    const far = snaps.find((actor) => actor.id === "far");
    expect(walker?.visible).toBe(true);
    expect(walker?.x).toBeCloseTo(100);
    expect(far?.visible).toBe(false);
    expect(far?.x).toBeCloseTo(5000);

    world.update(1, viewport(0));
    const farAgain = world.snapshots().find((actor) => actor.id === "far");
    expect(farAgain?.x).toBeCloseTo(5000);
    expect(farAgain?.visible).toBe(false);
  });

  it("does not accumulate speed while paused and steps once after resume (W-U-04)", () => {
    const time = new TimeService(new EventBus());
    const world = new WorldRuntime();
    world.load(scene());
    const vp = viewport(0);
    world.update(time.gameDt(0), vp);
    const start = world.getActorPosition("walker")?.x ?? 0;

    time.setPaused(true);
    world.update(time.gameDt(3), vp);
    world.update(time.gameDt(4), vp);
    expect(world.getActorPosition("walker")?.x).toBeCloseTo(start);

    time.setPaused(false);
    world.update(time.gameDt(0.25), vp);
    expect(world.getActorPosition("walker")?.x).toBeCloseTo(start + 25);
  });

  it("keeps a frozen actor on its last frame without simulating", () => {
    const world = new WorldRuntime();
    world.load(scene(), { activeMargin: 40 });
    world.update(0.5, viewport(0));
    const moved = world.getActorPosition("walker")?.x ?? 0;
    expect(moved).toBeGreaterThan(0);
    world.update(1, viewport(220));
    const held = world.snapshots().find((actor) => actor.id === "walker");
    expect(held?.visible).toBe(true);
    expect(held?.x).toBeCloseTo(moved);
  });
});
