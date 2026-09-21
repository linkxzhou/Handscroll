import { describe, expect, it } from "vitest";
import type { SchedulerLike, ViewportState } from "@handscroll/core";
import {
  APPROACH_SECONDS,
  BRIDGE_CONTINUOUS_REASON,
  BRIDGE_ENTITY_ID,
  DONE_SECONDS,
  HAUL_BOOST,
  MAST_SECONDS,
  UNDER_SECONDS,
  createBridgeController,
  isBridgeTrigger,
} from "./bridge.ts";
import { BRIDGE_PATH } from "../coords.ts";

function mockEngine() {
  const continuous = new Set<string>();
  const frames: number[] = [];
  const flights: { centerX: number; centerY: number; zoom: number; duration: number }[] = [];
  const scheduler: SchedulerLike = {
    requestFrame: () => {
      frames.push(1);
    },
    wake: () => {
      frames.push(1);
    },
    requestContinuous: (reason: string) => {
      continuous.add(reason);
    },
    releaseContinuous: (reason: string) => {
      continuous.delete(reason);
    },
  };
  const viewport: ViewportState = { centerX: 3258, centerY: 362, zoom: 1, screenWidth: 1280, screenHeight: 720 };
  return {
    scheduler,
    continuous,
    frames,
    flights,
    camera: {
      flyTo: (opts: { centerX: number; centerY: number; zoom: number; duration: number }) => {
        flights.push(opts);
      },
    },
    getViewport: () => viewport,
    getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
    getScrollId: () => "qingming-riverside",
  };
}

function runUntil(bridge: ReturnType<typeof createBridgeController>, mode: string, dt = 0.2): number {
  let guard = 0;
  while (bridge.getState().mode !== mode && guard++ < 800) {
    bridge.step(dt);
  }
  return guard;
}

describe("qingming bridge Q-D-01", () => {
  it("maps the dedicated hotspot id", () => {
    expect(isBridgeTrigger(BRIDGE_ENTITY_ID)).toBe(true);
    expect(isBridgeTrigger("hotspot-bridge")).toBe(false);
    expect(isBridgeTrigger("dock-west")).toBe(false);
  });

  it("runs idle → approaching → mast → under → done → idle without haul", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.start("hotspot")).toBe(true);
    expect(engine.continuous.has(BRIDGE_CONTINUOUS_REASON)).toBe(true);
    expect(engine.flights.length).toBe(1);
    expect(bridge.getState().mode).toBe("approaching");
    expect(bridge.getState().x).toBe(BRIDGE_PATH.approach.x);

    expect(runUntil(bridge, "mast")).toBeGreaterThan(0);
    expect(bridge.getState().mode).toBe("mast");
    expect(bridge.getState().mast).toBe(0);

    expect(runUntil(bridge, "under")).toBeGreaterThan(0);
    expect(bridge.getState().mode).toBe("under");
    expect(bridge.getState().mast).toBe(1);
    expect(bridge.getState().occluded).toBe(true);

    expect(runUntil(bridge, "done")).toBeGreaterThan(0);
    expect(bridge.getState().mode).toBe("done");
    expect(bridge.getState().x).toBeCloseTo(BRIDGE_PATH.underEnd.x, 5);
    expect(bridge.getState().occluded).toBe(true);

    expect(runUntil(bridge, "idle")).toBeGreaterThan(0);
    expect(bridge.getState().mode).toBe("idle");
    expect(engine.continuous.has(BRIDGE_CONTINUOUS_REASON)).toBe(false);
    bridge.dispose();
  });

  it("holding haul speeds mast lowering versus spectating", () => {
    const spectatorEngine = mockEngine();
    const helperEngine = mockEngine();
    const spectator = createBridgeController(spectatorEngine, { autoTick: false });
    const helper = createBridgeController(helperEngine, { autoTick: false });
    spectator.start();
    helper.start();
    spectator.step(APPROACH_SECONDS);
    helper.step(APPROACH_SECONDS);
    expect(spectator.getState().mode).toBe("mast");
    expect(helper.getState().mode).toBe("mast");

    helper.haul(true);
    spectator.step(MAST_SECONDS / 2);
    helper.step(MAST_SECONDS / 2);
    expect(helper.getState().progress).toBeGreaterThan(spectator.getState().progress);
    expect(helper.getState().progress).toBeCloseTo(Math.min(1, 0.5 * HAUL_BOOST), 5);
    expect(spectator.getState().progress).toBeCloseTo(0.5, 5);
    spectator.dispose();
    helper.dispose();
  });

  it("Escape / cancel from approaching cleans up and can restart", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    bridge.start();
    bridge.step(1);
    expect(bridge.getState().mode).toBe("approaching");
    expect(bridge.handleKey({ key: "Escape" })).toBe(true);
    expect(bridge.getState().mode).toBe("idle");
    expect(engine.continuous.has(BRIDGE_CONTINUOUS_REASON)).toBe(false);
    expect(bridge.cancel()).toBe(false);
    expect(bridge.start()).toBe(true);
    expect(bridge.getState().mode).toBe("approaching");
    bridge.dispose();
  });

  it("cancel from mast and under returns idle without finishing", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    bridge.start();
    runUntil(bridge, "mast");
    expect(bridge.cancel()).toBe(true);
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.getState().occluded).toBe(false);

    bridge.start();
    runUntil(bridge, "under");
    expect(bridge.getState().occluded).toBe(true);
    expect(bridge.cancel()).toBe(true);
    expect(bridge.getState().mode).toBe("idle");
    expect(bridge.getState().x).toBe(BRIDGE_PATH.approach.x);
    bridge.dispose();
  });

  it("ignores a second start while crossing and ignores haul away from the rope", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    expect(bridge.start()).toBe(true);
    expect(bridge.start()).toBe(false);
    bridge.haul(true);
    expect(bridge.getState().haul).toBe(false);
    runUntil(bridge, "mast");
    bridge.handleKey({ type: "keydown", key: "ArrowLeft" });
    expect(bridge.getState().haul).toBe(true);
    bridge.handleKey({ type: "keyup", key: "ArrowLeft" });
    expect(bridge.getState().haul).toBe(false);
    bridge.dispose();
  });

  it("dispose is idempotent and stops further motion", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    bridge.start();
    bridge.step(0.5);
    const xMid = bridge.getState().x;
    expect(xMid).not.toBe(BRIDGE_PATH.approach.x);
    bridge.dispose();
    bridge.dispose();
    expect(bridge.getState().disposed).toBe(true);
    expect(engine.continuous.has(BRIDGE_CONTINUOUS_REASON)).toBe(false);
    bridge.step(UNDER_SECONDS);
    expect(bridge.getState().x).toBe(xMid);
    expect(bridge.start()).toBe(false);
    expect(bridge.cancel()).toBe(false);
    expect(bridge.handleKey({ key: "Escape" })).toBe(false);
  });

  it("done lingers then returns idle after DONE_SECONDS", () => {
    const engine = mockEngine();
    const bridge = createBridgeController(engine, { autoTick: false });
    bridge.start();
    bridge.step(APPROACH_SECONDS);
    bridge.step(MAST_SECONDS);
    bridge.step(UNDER_SECONDS);
    expect(bridge.getState().mode).toBe("done");
    bridge.step(DONE_SECONDS);
    expect(bridge.getState().mode).toBe("idle");
    bridge.dispose();
  });
});
