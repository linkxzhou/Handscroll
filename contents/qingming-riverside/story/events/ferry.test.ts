import { describe, expect, it } from "vitest";
import type { SchedulerLike, ViewportState } from "@handscroll/core";
import {
  CROSSING_SECONDS,
  FERRY_CONTINUOUS_REASON,
  createFerryController,
  dockIdToBerth,
  oppositeBerth,
} from "./ferry.ts";
import { BERTHS } from "../coords.ts";

function mockEngine() {
  const continuous = new Set<string>();
  const frames: number[] = [];
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
    getViewport: () => viewport,
    getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
    getScrollId: () => "qingming-riverside",
  };
}

describe("qingming ferry Q-C-01", () => {
  it("maps dock entity ids to berths", () => {
    expect(dockIdToBerth("dock-west")).toBe("west");
    expect(dockIdToBerth("dock-east")).toBe("east");
    expect(dockIdToBerth("hotspot-bridge")).toBeNull();
    expect(oppositeBerth("east")).toBe("west");
  });

  it("crosses from the idle east berth to the west dock", () => {
    const engine = mockEngine();
    const ferry = createFerryController(engine, { autoTick: false });
    expect(ferry.getState().berth).toBe("east");
    expect(ferry.getState().x).toBe(BERTHS.east.x);
    expect(ferry.summon("dock-west")).toBe(true);
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(true);
    expect(ferry.getState().mode).toBe("crossing");

    let guard = 0;
    while (ferry.getState().mode !== "idle" && guard++ < 400) {
      ferry.step(CROSSING_SECONDS / 20);
    }
    expect(ferry.getState().mode).toBe("idle");
    expect(ferry.getState().berth).toBe("west");
    expect(ferry.getState().x).toBeCloseTo(BERTHS.west.x, 5);
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(false);
    ferry.dispose();
  });

  it("clicking the current dock starts a crossing to the opposite shore", () => {
    const engine = mockEngine();
    const ferry = createFerryController(engine, { autoTick: false });
    expect(ferry.summon("dock-east")).toBe(true);
    expect(ferry.getState().destination).toBe("west");
    ferry.dispose();
  });

  it("dispose is idempotent and stops further motion (Q-C-01 / Q-C-02)", () => {
    const engine = mockEngine();
    const ferry = createFerryController(engine, { autoTick: false });
    ferry.summon("dock-west");
    ferry.step(0.5);
    const xMid = ferry.getState().x;
    expect(xMid).not.toBe(BERTHS.east.x);
    ferry.dispose();
    ferry.dispose();
    expect(ferry.getState().disposed).toBe(true);
    expect(engine.continuous.has(FERRY_CONTINUOUS_REASON)).toBe(false);
    ferry.step(1);
    expect(ferry.getState().x).toBe(xMid);
    expect(ferry.summon("dock-east")).toBe(false);
  });
});
