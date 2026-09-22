import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { SchedulerLike } from "@handscroll/core";
import {
  CROSSING_SECONDS,
  FERRY_ACTOR_ID,
  FERRY_PATH_ID,
  createFerryController,
  dockIdToBerth,
  oppositeBerth,
  planCrossing,
} from "./ferry.ts";
import { scenePathLength } from "../paths.ts";

function mockEngine() {
  const events = new EventBus();
  const frames: number[] = [];
  const scheduler: SchedulerLike = {
    requestFrame: () => {
      frames.push(1);
    },
    wake: () => {},
    requestContinuous: () => {},
    releaseContinuous: () => {},
  };
  return { events, scheduler, frames };
}

describe("qingming ferry", () => {
  it("maps dock entity ids to berths", () => {
    expect(dockIdToBerth("dock-west")).toBe("west");
    expect(dockIdToBerth("dock-east")).toBe("east");
    expect(dockIdToBerth("hotspot-bridge")).toBeNull();
    expect(oppositeBerth("east")).toBe("west");
  });

  it("plans a crossing from the east berth toward the west dock", () => {
    const length = scenePathLength(FERRY_PATH_ID);
    const plan = planCrossing("east", "west", length);
    expect(plan.destination).toBe("west");
    expect(plan.fromDistance).toBeCloseTo(length);
    expect(plan.toDistance).toBe(0);
    expect(plan.speed).toBeCloseTo(length / CROSSING_SECONDS);
    expect(planCrossing("east", "east", length).destination).toBe("west");
  });

  it("emits one vessel summon and completes on arrival", () => {
    const engine = mockEngine();
    const summons: unknown[] = [];
    engine.events.on("vessel:summon", (payload) => summons.push(payload));
    const ferry = createFerryController(engine);
    expect(ferry.getState().berth).toBe("east");
    expect(ferry.summon("dock-west")).toBe(true);
    expect(ferry.getState().mode).toBe("crossing");
    expect(summons).toHaveLength(1);
    expect(ferry.summon("dock-east")).toBe(false);

    engine.events.emit("vessel:arrived", { actorId: FERRY_ACTOR_ID, pathId: FERRY_PATH_ID });
    expect(ferry.getState().mode).toBe("idle");
    expect(ferry.getState().berth).toBe("west");
    ferry.dispose();
  });

  it("accepts dock:request from a zone-style trigger payload", () => {
    const engine = mockEngine();
    const ferry = createFerryController(engine);
    engine.events.emit("dock:request", { berth: "west" });
    expect(ferry.getState().mode).toBe("crossing");
    expect(ferry.getState().destination).toBe("west");
    ferry.dispose();
  });

  it("dispose is idempotent and ignores later summons", () => {
    const engine = mockEngine();
    const ferry = createFerryController(engine);
    ferry.summon("dock-west");
    ferry.dispose();
    ferry.dispose();
    expect(ferry.getState().disposed).toBe(true);
    expect(ferry.summon("dock-east")).toBe(false);
    engine.events.emit("dock:request", { berth: "east" });
    expect(ferry.getState().mode).toBe("idle");
  });
});
