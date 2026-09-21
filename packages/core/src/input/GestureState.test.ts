import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD_PX, GestureState } from "./GestureState.ts";

describe("GestureState E-U-05/06", () => {
  it("stays pressed when movement is under the drag threshold (E-U-05)", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 10, y: 10 });
    const update = g.pointerMove({ id: 1, x: 10 + DRAG_THRESHOLD_PX - 1, y: 10 });
    expect(update.kind).toBe("pressed");
    expect(g.kind).toBe("pressed");
  });

  it("enters pinching with midpoint as the pinch center (E-U-06)", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    const pinch = g.pointerDown({ id: 2, x: 100, y: 40 });
    expect(pinch.kind).toBe("pinching");
    expect(g.kind).toBe("pinching");
    expect(pinch.pinchCenter).toEqual({ x: 50, y: 20 });
  });
});
