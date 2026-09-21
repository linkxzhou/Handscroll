import { describe, expect, it } from "vitest";
import { selectLod } from "./LodSelector.ts";

const levels = [
  { id: "0", scale: 0.25 },
  { id: "1", scale: 0.5 },
  { id: "2", scale: 1 },
];

describe("selectLod E-U-07", () => {
  it("picks the coarsest level that still covers zoom * dpr", () => {
    expect(selectLod(levels, 0.4, 1).level.id).toBe("1");
    expect(selectLod(levels, 1.2, 1).level.id).toBe("2");
    expect(selectLod(levels, 0.1, 1).level.id).toBe("0");
  });

  it("accounts for render DPR when choosing a level", () => {
    expect(selectLod(levels, 0.2, 1).level.id).toBe("0");
    expect(selectLod(levels, 0.2, 2).level.id).toBe("1");
  });

  it("holds the current level inside the hysteresis band", () => {
    const stay = selectLod(levels, 0.48, 1, "1", 0.12);
    expect(stay.level.id).toBe("1");
    const drop = selectLod(levels, 0.2, 1, "1", 0.12);
    expect(drop.level.id).toBe("0");
  });

  it("does not jump to a sharper level until the target clears hysteresis", () => {
    const hold = selectLod(levels, 0.52, 1, "1", 0.12);
    expect(hold.level.id).toBe("1");
    const up = selectLod(levels, 0.7, 1, "1", 0.12);
    expect(up.level.id).toBe("2");
  });

  it("throws when no levels are provided", () => {
    expect(() => selectLod([], 1, 1)).toThrow(/No LOD levels/);
  });
});
