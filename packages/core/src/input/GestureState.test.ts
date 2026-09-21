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

  it("enters dragging once movement crosses the threshold", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    const update = g.pointerMove({ id: 1, x: DRAG_THRESHOLD_PX + 4, y: 0 });
    expect(update.kind).toBe("dragging");
    expect(update.dx).toBe(DRAG_THRESHOLD_PX + 4);
  });

  it("returns inertia on pointerUp after a drag", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    g.pointerMove({ id: 1, x: 40, y: 0 });
    const up = g.pointerUp(1);
    expect(up.kind).toBe("inertia");
    expect(g.kind).toBe("idle");
  });

  it("returns idle on pointerUp from a press without drag", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 5, y: 5 });
    const up = g.pointerUp(1);
    expect(up.kind).toBe("idle");
  });

  it("enters pinching with midpoint as the pinch center (E-U-06)", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    const pinch = g.pointerDown({ id: 2, x: 100, y: 40 });
    expect(pinch.kind).toBe("pinching");
    expect(g.kind).toBe("pinching");
    expect(pinch.pinchCenter).toEqual({ x: 50, y: 20 });
  });

  it("reports pinch factor when the span doubles", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    g.pointerDown({ id: 2, x: 40, y: 0 });
    const update = g.pointerMove({ id: 2, x: 80, y: 0 });
    expect(update.kind).toBe("pinching");
    expect(update.pinchFactor).toBeCloseTo(2, 5);
    expect(update.pinchCenter).toEqual({ x: 40, y: 0 });
  });

  it("falls back to dragging when one pinch pointer lifts", () => {
    const g = new GestureState();
    g.pointerDown({ id: 1, x: 0, y: 0 });
    g.pointerDown({ id: 2, x: 40, y: 0 });
    const up = g.pointerUp(2);
    expect(up.kind).toBe("dragging");
    expect(g.kind).toBe("dragging");
  });
});
