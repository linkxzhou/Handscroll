import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { SchedulerLike } from "@handscroll/core";
import {
  APPROACH_SECONDS,
  CARGO_ACTOR_ID,
  DONE_SECONDS,
  HAUL_BOOST,
  MAST_SECONDS,
  OCCLUDER_ACTOR_ID,
  OCCLUDER_ALPHA,
  UNDER_SECONDS,
  createBridgeController,
  isBridgeTrigger,
  legSpeed,
} from "./bridge-quest.ts";
import { BRIDGE_ENTITY_ID } from "./bridge-quest.ts";

function mockEngine() {
  const events = new EventBus();
  const flights: { centerX: number; centerY: number; zoom: number; duration: number }[] = [];
  const scheduler: SchedulerLike = {
    requestFrame: () => {},
    wake: () => {},
    requestContinuous: () => {},
    releaseContinuous: () => {},
  };
  return {
    events,
    scheduler,
    flights,
    camera: {
      flyTo(opts: { centerX: number; centerY: number; zoom: number; duration: number }) {
        flights.push(opts);
      },
    },
    getUiLayer: () => ({ appendChild: (node: unknown) => node }) as HTMLElement,
  };
}

function arrive(engine: ReturnType<typeof mockEngine>): void {
  engine.events.emit("vessel:arrived", { actorId: CARGO_ACTOR_ID, pathId: "bridge-cargo" });
}

describe("qingming bridge quest", () => {
  it("maps the dedicated hotspot id", () => {
    expect(isBridgeTrigger(BRIDGE_ENTITY_ID)).toBe(true);
    expect(isBridgeTrigger("hotspot-bridge")).toBe(false);
    expect(isBridgeTrigger("dock-west")).toBe(false);
  });

  it("scales haul speed by the pack boost", () => {
    const base = legSpeed(100, MAST_SECONDS, false);
    expect(legSpeed(100, MAST_SECONDS, true)).toBeCloseTo(base * HAUL_BOOST);
    expect(legSpeed(80, APPROACH_SECONDS, false)).toBeCloseTo(80 / APPROACH_SECONDS);
    expect(legSpeed(40, UNDER_SECONDS, true)).toBeCloseTo((40 / UNDER_SECONDS) * HAUL_BOOST);
  });

  it("runs idle → approaching → mast → under → done → idle", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { timer: false });
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.start("hotspot")).toBe(true);
    expect(engine.flights).toHaveLength(1);
    expect(engine.flights[0]?.duration).toBe(800);
    expect(bridge.getState().mode).toBe("approaching");
    expect(bridge.getState().mast).toBe(0);

    arrive(engine);
    expect(bridge.getState().mode).toBe("mast");
    expect(bridge.getState().mast).toBe(0);
    expect(bridge.getState().occluded).toBe(false);

    arrive(engine);
    expect(bridge.getState().mode).toBe("under");
    expect(bridge.getState().mast).toBe(1);
    expect(bridge.getState().occluded).toBe(true);

    arrive(engine);
    expect(bridge.getState().mode).toBe("done");
    bridge.step(DONE_SECONDS);
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.getState().occluded).toBe(false);
    bridge.dispose();
  });

  it("re-summons the current leg faster while the haul is held", () => {
    const engine = mockEngine();
    const speeds: number[] = [];
    engine.events.on("vessel:summon", (payload) => {
      if (payload && typeof payload === "object" && "speed" in payload && typeof (payload as { speed: unknown }).speed === "number") {
        speeds.push((payload as { speed: number }).speed);
      }
    });
    const bridge = createBridgeController(engine, { timer: false });
    bridge.start();
    arrive(engine);
    const base = speeds.at(-1) ?? 0;
    expect(base).toBeGreaterThan(0);
    bridge.haul(true);
    expect(bridge.getState().haul).toBe(true);
    expect(speeds.at(-1)).toBeCloseTo(base * HAUL_BOOST);
    bridge.haul(false);
    expect(speeds.at(-1)).toBeCloseTo(base);
    bridge.dispose();
  });

  it("Escape from approaching resets the hull and can restart", () => {
    const engine = mockEngine();
    const summons: { quiet?: boolean; fromDistance?: number }[] = [];
    engine.events.on("vessel:summon", (payload) => {
      summons.push(payload as { quiet?: boolean; fromDistance?: number });
    });
    const bridge = createBridgeController(engine, { timer: false });
    bridge.start();
    expect(bridge.handleKey({ key: "Escape" })).toBe(true);
    expect(bridge.getState().mode).toBe("idle");
    expect(summons.at(-1)?.quiet).toBe(true);
    expect(summons.at(-1)?.fromDistance).toBe(0);
    expect(bridge.cancel()).toBe(false);
    expect(bridge.start()).toBe(true);
    expect(bridge.getState().mode).toBe("approaching");
    bridge.dispose();
  });

  it("cancel from under clears the occluder", () => {
    const engine = mockEngine();
    const alphas: number[] = [];
    engine.events.on("actor:alpha", (payload) => {
      if (payload && typeof payload === "object" && (payload as { id?: unknown }).id === OCCLUDER_ACTOR_ID) {
        alphas.push((payload as { alpha: number }).alpha);
      }
    });
    const bridge = createBridgeController(engine, { timer: false });
    bridge.start();
    arrive(engine);
    arrive(engine);
    expect(bridge.getState().occluded).toBe(true);
    expect(alphas).toContain(OCCLUDER_ALPHA);
    expect(bridge.cancel()).toBe(true);
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.getState().occluded).toBe(false);
    expect(alphas.at(-1)).toBe(0);
    bridge.dispose();
  });

  it("ignores a second start while crossing and ignores haul before the rope stage", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { timer: false });
    expect(bridge.start()).toBe(true);
    expect(bridge.start()).toBe(false);
    bridge.haul(true);
    expect(bridge.getState().haul).toBe(false);
    arrive(engine);
    bridge.handleKey({ type: "keydown", key: "ArrowLeft" });
    expect(bridge.getState().haul).toBe(true);
    bridge.handleKey({ type: "keyup", key: "ArrowLeft" });
    expect(bridge.getState().haul).toBe(false);
    bridge.dispose();
  });

  it("dispose is idempotent and ignores later input", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { timer: false });
    bridge.start();
    bridge.dispose();
    bridge.dispose();
    expect(bridge.getState().disposed).toBe(true);
    arrive(engine);
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.start()).toBe(false);
    expect(bridge.cancel()).toBe(false);
    expect(bridge.handleKey({ key: "Escape" })).toBe(false);
  });
});
