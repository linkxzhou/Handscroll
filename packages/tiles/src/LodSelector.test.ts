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

  it("holds the current level inside the hysteresis band", () => {
    const stay = selectLod(levels, 0.48, 1, "1", 0.12);
    expect(stay.level.id).toBe("1");
    const drop = selectLod(levels, 0.2, 1, "1", 0.12);
    expect(drop.level.id).toBe("0");
  });
});
