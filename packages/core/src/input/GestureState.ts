export type GestureKind = "idle" | "pressed" | "dragging" | "pinching" | "inertia";

export const DRAG_THRESHOLD_PX = 8;

export interface PointerSample {
  id: number;
  x: number;
  y: number;
}

export interface GestureUpdate {
  kind: GestureKind;
  dx: number;
  dy: number;
  pinchFactor?: number;
  pinchCenter?: { x: number; y: number };
}

function midpoint(a: PointerSample, b: PointerSample): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class GestureState {
  kind: GestureKind = "idle";
  readonly pointers = new Map<number, PointerSample>();
  private pressX = 0;
  private pressY = 0;
  private lastX = 0;
  private lastY = 0;
  private lastPinchDistance = 0;
  private lastPinchCenter = { x: 0, y: 0 };

  pointerDown(sample: PointerSample): GestureUpdate {
    this.pointers.set(sample.id, sample);
    if (this.pointers.size >= 2) {
      const [a, b] = this.pair();
      this.kind = "pinching";
      this.lastPinchDistance = distance(a, b);
      this.lastPinchCenter = midpoint(a, b);
      return { kind: this.kind, dx: 0, dy: 0, pinchFactor: 1, pinchCenter: this.lastPinchCenter };
    }
    this.kind = "pressed";
    this.pressX = sample.x;
    this.pressY = sample.y;
    this.lastX = sample.x;
    this.lastY = sample.y;
    return { kind: this.kind, dx: 0, dy: 0 };
  }

  pointerMove(sample: PointerSample): GestureUpdate {
    const prev = this.pointers.get(sample.id);
    this.pointers.set(sample.id, sample);
    if (!prev) return { kind: this.kind, dx: 0, dy: 0 };

    if (this.kind === "pinching" && this.pointers.size >= 2) {
      const [a, b] = this.pair();
      const dist = distance(a, b);
      const center = midpoint(a, b);
      const factor = this.lastPinchDistance > 0 ? dist / this.lastPinchDistance : 1;
      const dx = center.x - this.lastPinchCenter.x;
      const dy = center.y - this.lastPinchCenter.y;
      this.lastPinchDistance = dist;
      this.lastPinchCenter = center;
      return { kind: this.kind, dx, dy, pinchFactor: factor, pinchCenter: center };
    }

    const dx = sample.x - this.lastX;
    const dy = sample.y - this.lastY;
    this.lastX = sample.x;
    this.lastY = sample.y;

    if (this.kind === "pressed") {
      const total = Math.hypot(sample.x - this.pressX, sample.y - this.pressY);
      if (total < DRAG_THRESHOLD_PX) {
        return { kind: this.kind, dx: 0, dy: 0 };
      }
      this.kind = "dragging";
    }

    if (this.kind === "dragging") {
      return { kind: this.kind, dx, dy };
    }

    return { kind: this.kind, dx: 0, dy: 0 };
  }

  pointerUp(id: number): GestureUpdate {
    this.pointers.delete(id);
    if (this.kind === "pinching") {
      if (this.pointers.size >= 2) {
        const [a, b] = this.pair();
        this.lastPinchDistance = distance(a, b);
        this.lastPinchCenter = midpoint(a, b);
        return { kind: this.kind, dx: 0, dy: 0 };
      }
      const remaining = [...this.pointers.values()][0];
      if (remaining) {
        this.kind = "dragging";
        this.lastX = remaining.x;
        this.lastY = remaining.y;
        return { kind: this.kind, dx: 0, dy: 0 };
      }
    }
    const next: GestureKind = this.kind === "dragging" ? "inertia" : "idle";
    this.kind = next === "inertia" ? "idle" : "idle";
    return { kind: next, dx: 0, dy: 0 };
  }

  reset(): void {
    this.kind = "idle";
    this.pointers.clear();
  }

  private pair(): [PointerSample, PointerSample] {
    const all = [...this.pointers.values()];
    const a = all[0];
    const b = all[1];
    if (!a || !b) {
      throw new Error("Expected two pointers");
    }
    return [a, b];
  }
}
