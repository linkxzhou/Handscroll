import { describe, expect, it } from "vitest";
import {
  BERTHS,
  CHAPTERS,
  REF_SHIFT_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  fromRef,
  inWorld,
  toRef,
  worldToScreen,
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
});
