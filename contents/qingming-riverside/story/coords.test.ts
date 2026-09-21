import { describe, expect, it } from "vitest";
import {
  BERTHS,
  BRIDGE_APEX,
  BRIDGE_OCCLUDER,
  BRIDGE_PATH,
  CHAPTERS,
  REF_SHIFT_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  fromRef,
  inWorld,
  pointAlong,
  polylineLength,
  toRef,
  worldToScreen,
  STREET_PATHS,
  SHOPS,
  WATER_BAND,
} from "./coords.ts";

describe("qingming coords Q-A-03", () => {
  it("shifts reference x by +2172 and keeps y", () => {
    expect(fromRef(0, 0)).toEqual({ x: 2172, y: 0 });
    expect(fromRef(-2172, 12)).toEqual({ x: 0, y: 12 });
    expect(toRef(2172, 12)).toEqual({ x: 0, y: 12 });
    expect(REF_SHIFT_X).toBe(2172);
  });

  it("maps sample landmarks into the stitched world", () => {
    const samples = [
      fromRef(-1550, 400),
      fromRef(650, 444),
      fromRef(1560, 400),
      fromRef(3360, 400),
      fromRef(630, 556),
      fromRef(2085, 556),
      BRIDGE_PATH.approach,
      BRIDGE_PATH.mastStart,
      BRIDGE_PATH.mastEnd,
      BRIDGE_PATH.underEnd,
      BRIDGE_APEX,
      { x: BRIDGE_OCCLUDER.x, y: BRIDGE_OCCLUDER.y },
      ...STREET_PATHS.teahouse,
      ...STREET_PATHS.bridge,
      ...STREET_PATHS.gate,
      SHOPS.teahouse,
      SHOPS.bridgeStall,
      SHOPS.gateStall,
    ];
    for (const p of samples) {
      expect(inWorld(p.x, p.y)).toBe(true);
    }
    expect(BERTHS.west.x).toBe(630 + 2172);
    expect(BERTHS.east.x).toBe(2085 + 2172);
    expect(CHAPTERS.watermill.centerX).toBe(622);
    expect(CHAPTERS.gate.centerX).toBe(5532);
  });

  it("rejects points on the far edge and outside", () => {
    expect(inWorld(0, 0)).toBe(true);
    expect(inWorld(WORLD_WIDTH - 1, WORLD_HEIGHT - 1)).toBe(true);
    expect(inWorld(WORLD_WIDTH, 0)).toBe(false);
    expect(inWorld(0, WORLD_HEIGHT)).toBe(false);
    expect(inWorld(-1, 10)).toBe(false);
  });

  it("projects world points through the viewport", () => {
    const screen = worldToScreen(
      { centerX: 100, centerY: 50, zoom: 2, screenWidth: 200, screenHeight: 100 },
      100,
      50,
    );
    expect(screen).toEqual({ x: 100, y: 50 });
  });

  it("keeps the river band and street polylines on the stitch", () => {
    expect(WATER_BAND.y + WATER_BAND.h).toBe(WORLD_HEIGHT);
    expect(polylineLength(STREET_PATHS.teahouse)).toBeGreaterThan(0);
    const mid = pointAlong(STREET_PATHS.teahouse, polylineLength(STREET_PATHS.teahouse) / 2);
    expect(inWorld(mid.x, mid.y)).toBe(true);
    expect(inWorld(SHOPS.gateStall.x, SHOPS.gateStall.y)).toBe(true);
  });
});
