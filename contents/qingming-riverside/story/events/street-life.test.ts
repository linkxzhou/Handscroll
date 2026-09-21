import { describe, expect, it } from "vitest";
import type { SchedulerLike, ViewportState } from "@handscroll/core";
import { CHAPTERS, STREET_PATHS, inActiveZone } from "../coords.ts";
import {
  ACTIVE_MARGIN,
  STREET_CONTINUOUS_REASON,
  STREET_LIFE_Z_INDEX,
  WALKER_WORLD,
  createStreetLifeController,
  shopLabelScreen,
  walkerScreenSize,
} from "./street-life.ts";

function mockEngine(viewport: ViewportState) {
  const continuous = new Set<string>();
  let vp = viewport;
  const scheduler: SchedulerLike = {
    requestFrame: () => {},
    wake: () => {},
    requestContinuous: (reason: string) => {
      continuous.add(reason);
    },
    releaseContinuous: (reason: string) => {
      continuous.delete(reason);
    },
  };
  return {
    continuous,
    scheduler,
    setViewport(next: ViewportState) {
      vp = next;
    },
    getViewport: () => vp,
    getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
  };
}

describe("qingming street-life", () => {
  it("advances nearby pedestrians and freezes far ones", () => {
    const near: ViewportState = {
      centerX: CHAPTERS.teahouse.centerX,
      centerY: CHAPTERS.teahouse.centerY,
      zoom: 1.2,
      screenWidth: 800,
      screenHeight: 600,
    };
    const engine = mockEngine(near);
    const street = createStreetLifeController(engine, { autoTick: false });
    const before = street.getState().walkers.find((w) => w.path === "teahouse");
    expect(before?.active).toBe(true);
    street.step(0.5);
    const after = street.getState().walkers.find((w) => w.path === "teahouse");
    expect(after && before && Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0);
    expect(engine.continuous.has(STREET_CONTINUOUS_REASON)).toBe(true);

    const far: ViewportState = {
      centerX: 80,
      centerY: 80,
      zoom: 1.4,
      screenWidth: 200,
      screenHeight: 160,
    };
    engine.setViewport(far);
    const frozen = street.getState().walkers.find((w) => w.path === "teahouse");
    expect(frozen?.active).toBe(false);
    const x = frozen?.x;
    street.step(1);
    const still = street.getState().walkers.find((w) => w.path === "teahouse");
    expect(still?.x).toBe(x);

    street.dispose();
    street.dispose();
    expect(street.getState().disposed).toBe(true);
    expect(engine.continuous.has(STREET_CONTINUOUS_REASON)).toBe(false);
    const last = still?.x;
    street.step(1);
    expect(street.getState().walkers.find((w) => w.path === "teahouse")?.x).toBe(last);
  });

  it("cycles shop labels only in the active zone", () => {
    const engine = mockEngine({
      centerX: CHAPTERS.teahouse.centerX,
      centerY: CHAPTERS.teahouse.centerY,
      zoom: 1,
      screenWidth: 900,
      screenHeight: 700,
    });
    const street = createStreetLifeController(engine, { autoTick: false });
    const first = street.getState().shops.find((s) => s.id === "shop-teahouse")?.label;
    street.step(3);
    const second = street.getState().shops.find((s) => s.id === "shop-teahouse")?.label;
    expect(second).not.toBe(first);
    street.dispose();
  });

  it("treats distant gate walkers as outside the teahouse active zone", () => {
    const tea = STREET_PATHS.teahouse[1]!;
    const vp: ViewportState = {
      centerX: CHAPTERS.gate.centerX,
      centerY: CHAPTERS.gate.centerY,
      zoom: 1.1,
      screenWidth: 400,
      screenHeight: 300,
    };
    expect(inActiveZone(tea.x, tea.y, vp, ACTIVE_MARGIN)).toBe(false);
  });

  it("sizes walkers in world units so they read as people, not CSS-pixel stubs", () => {
    expect(WALKER_WORLD.height).toBeGreaterThanOrEqual(40);
    expect(WALKER_WORLD.height).toBeLessThan(90);
    expect(WALKER_WORLD.width).toBeGreaterThanOrEqual(16);
    expect(walkerScreenSize(0.9).width).toBeCloseTo(WALKER_WORLD.width * 0.9);
    expect(walkerScreenSize(0.9).height).toBeCloseTo(WALKER_WORLD.height * 0.9);
    expect(walkerScreenSize(0.9).height).toBeGreaterThan(40);
    expect(walkerScreenSize(1.2).height).toBeCloseTo(WALKER_WORLD.height * 1.2);
    expect(shopLabelScreen(1).font).toBe(14);
    expect(shopLabelScreen(1.2).font).toBeGreaterThan(14);
    expect(STREET_LIFE_Z_INDEX).toBeGreaterThan(6);
  });

  it("keeps tea/bridge walkers active and large in the default opening frame", () => {
    const opening: ViewportState = {
      centerX: 3120,
      centerY: 362,
      zoom: 0.9,
      screenWidth: 1280,
      screenHeight: 720,
    };
    const engine = mockEngine(opening);
    const street = createStreetLifeController(engine, { autoTick: false });
    const state = street.getState();
    const tea = state.walkers.filter((w) => w.path === "teahouse");
    const bridge = state.walkers.filter((w) => w.path === "bridge");
    expect(tea.length).toBeGreaterThan(0);
    expect(tea.every((w) => w.active)).toBe(true);
    expect(bridge.every((w) => w.active)).toBe(true);
    expect(state.walkers.filter((w) => w.path === "gate").every((w) => w.active)).toBe(false);
    expect(tea[0]?.screenHeight).toBeCloseTo(WALKER_WORLD.height * 0.9);
    street.dispose();
  });
});
