import type { ViewportController } from "../viewport/ViewportController.ts";
import type { RenderScheduler } from "../scheduler/RenderScheduler.ts";
import { GestureState } from "./GestureState.ts";
import { isUiPointerTarget } from "./uiTarget.ts";

export interface InputManagerOptions {
  /** When true, wheel events call preventDefault (fullscreen viewer). */
  captureWheel?: boolean;
  dragThreshold?: number;
}

const INERTIA_MIN_SPEED = 120;

export class InputManager {
  private attached = false;
  private readonly gesture = new GestureState();
  private readonly velocities: { t: number; x: number; y: number }[] = [];
  private lastSampleT = 0;
  private onPointerDown?: (ev: PointerEvent) => void;
  private onPointerMove?: (ev: PointerEvent) => void;
  private onPointerUp?: (ev: PointerEvent) => void;
  private onPointerCancel?: (ev: PointerEvent) => void;
  private onWheel?: (ev: WheelEvent) => void;
  private onVisibility?: () => void;
  private onClick?: (ev: PointerEvent) => void;
  private suppressClick = false;

  constructor(
    private readonly target: HTMLElement,
    private readonly camera: ViewportController,
    private readonly scheduler: RenderScheduler,
    private readonly options: InputManagerOptions = {},
    private readonly onWorldClick?: (worldX: number, worldY: number, screenX: number, screenY: number) => void,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.onPointerDown = (ev) => {
      if (ev.button !== 0 && ev.pointerType === "mouse") return;
      if (isUiPointerTarget(ev.target)) return;
      this.camera.interruptTransition();
      this.scheduler.releaseContinuous("camera");
      this.target.setPointerCapture(ev.pointerId);
      const p = this.local(ev);
      this.gesture.pointerDown({ id: ev.pointerId, x: p.x, y: p.y });
      this.velocities.length = 0;
      this.lastSampleT = performance.now();
      this.suppressClick = false;
      this.scheduler.requestContinuous("pointer");
    };

    this.onPointerMove = (ev) => {
      if (this.gesture.kind === "idle") return;
      const p = this.local(ev);
      const update = this.gesture.pointerMove({ id: ev.pointerId, x: p.x, y: p.y });
      if (update.kind === "dragging") {
        this.camera.panByScreen(update.dx, update.dy);
        this.noteVelocity(update.dx, update.dy);
        this.suppressClick = true;
        this.scheduler.requestFrame();
      } else if (update.kind === "pinching") {
        this.suppressClick = true;
        if (update.dx || update.dy) this.camera.panByScreen(update.dx, update.dy);
        if (update.pinchFactor && update.pinchCenter) {
          this.camera.zoomAtScreen(update.pinchFactor, update.pinchCenter.x, update.pinchCenter.y);
        }
        this.scheduler.requestFrame();
      }
    };

    this.onPointerUp = (ev) => {
      const update = this.gesture.pointerUp(ev.pointerId);
      try {
        this.target.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      if (this.gesture.pointers.size === 0) {
        this.scheduler.releaseContinuous("pointer");
        if (update.kind === "inertia") {
          const v = this.velocity();
          if (Math.hypot(v.x, v.y) >= INERTIA_MIN_SPEED) {
            this.camera.setVelocity(v.x, v.y);
            this.scheduler.requestContinuous("inertia");
          }
        } else if (!this.suppressClick && this.onWorldClick) {
          const p = this.local(ev);
          const world = this.camera.screenToWorld(p.x, p.y);
          this.onWorldClick(world.x, world.y, p.x, p.y);
        }
        this.scheduler.requestFrame();
      }
    };

    this.onPointerCancel = (ev) => {
      this.gesture.reset();
      this.camera.setVelocity(0, 0);
      this.scheduler.releaseContinuous("pointer");
      this.scheduler.releaseContinuous("inertia");
      try {
        this.target.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    this.onWheel = (ev) => {
      if (this.options.captureWheel !== false) ev.preventDefault();
      const p = this.local(ev);
      const factor = Math.exp(-ev.deltaY * 0.0015);
      this.camera.interruptTransition();
      this.camera.zoomAtScreen(factor, p.x, p.y);
      this.scheduler.requestFrame();
    };

    this.onVisibility = () => {
      if (document.visibilityState === "hidden") {
        this.gesture.reset();
        this.camera.setVelocity(0, 0);
        this.scheduler.releaseContinuous("pointer");
        this.scheduler.releaseContinuous("inertia");
      }
    };

    this.target.addEventListener("pointerdown", this.onPointerDown);
    this.target.addEventListener("pointermove", this.onPointerMove);
    this.target.addEventListener("pointerup", this.onPointerUp);
    this.target.addEventListener("pointercancel", this.onPointerCancel);
    this.target.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    if (this.onPointerDown) this.target.removeEventListener("pointerdown", this.onPointerDown);
    if (this.onPointerMove) this.target.removeEventListener("pointermove", this.onPointerMove);
    if (this.onPointerUp) this.target.removeEventListener("pointerup", this.onPointerUp);
    if (this.onPointerCancel) this.target.removeEventListener("pointercancel", this.onPointerCancel);
    if (this.onWheel) this.target.removeEventListener("wheel", this.onWheel);
    if (this.onVisibility) document.removeEventListener("visibilitychange", this.onVisibility);
    this.gesture.reset();
  }

  update(_dt: number): void {
    if (!this.camera.isAnimating()) {
      this.scheduler.releaseContinuous("inertia");
      this.scheduler.releaseContinuous("camera");
    }
  }

  private local(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.target.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  private noteVelocity(dx: number, dy: number): void {
    const now = performance.now();
    const dt = Math.max(1, now - this.lastSampleT);
    this.lastSampleT = now;
    this.velocities.push({ t: now, x: (dx / dt) * 1000, y: (dy / dt) * 1000 });
    while (this.velocities.length > 5) this.velocities.shift();
  }

  private velocity(): { x: number; y: number } {
    if (this.velocities.length === 0) return { x: 0, y: 0 };
    const n = this.velocities.length;
    let x = 0;
    let y = 0;
    for (const sample of this.velocities) {
      x += sample.x;
      y += sample.y;
    }
    return { x: x / n, y: y / n };
  }
}
