export interface SchedulerHooks {
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
}

export class RenderScheduler {
  mode: "continuous" | "on-demand" = "on-demand";
  private running = false;
  private rafId = 0;
  private prev = 0;
  private pendingWake = false;
  private readonly reasons = new Set<string>();
  private loop: ((dt: number, now: number) => void) | null = null;
  private readonly nowFn: () => number;
  private readonly rafFn: (cb: FrameRequestCallback) => number;
  private readonly cafFn: (id: number) => void;
  private framesRun = 0;

  constructor(hooks: SchedulerHooks = {}) {
    this.nowFn = hooks.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.rafFn =
      hooks.raf ??
      ((cb) => {
        if (typeof requestAnimationFrame === "undefined") {
          return setTimeout(() => cb(this.nowFn()), 16) as unknown as number;
        }
        return requestAnimationFrame(cb);
      });
    this.cafFn =
      hooks.caf ??
      ((id) => {
        if (typeof cancelAnimationFrame === "undefined") {
          clearTimeout(id);
          return;
        }
        cancelAnimationFrame(id);
      });
  }

  start(loop: (dt: number, now: number) => void): void {
    this.loop = loop;
    this.running = true;
    this.prev = this.nowFn();
    this.requestFrame();
  }

  stop(): void {
    this.running = false;
    this.pendingWake = false;
    this.reasons.clear();
    if (this.rafId) this.cafFn(this.rafId);
    this.rafId = 0;
    this.loop = null;
  }

  requestFrame(): void {
    this.pendingWake = true;
    this.ensureRaf();
  }

  wake(): void {
    this.requestFrame();
  }

  requestContinuous(reason: string): void {
    this.reasons.add(reason);
    this.mode = "continuous";
    this.ensureRaf();
  }

  releaseContinuous(reason: string): void {
    this.reasons.delete(reason);
    if (this.reasons.size === 0) this.mode = "on-demand";
  }

  isRunning(): boolean {
    return this.running;
  }

  getPendingWake(): boolean {
    return this.pendingWake;
  }

  getFrameCount(): number {
    return this.framesRun;
  }

  private ensureRaf(): void {
    if (!this.running || this.rafId) return;
    this.rafId = this.rafFn((t) => this.tick(t));
  }

  private tick(now: number): void {
    this.rafId = 0;
    if (!this.running || !this.loop) return;
    const dt = Math.min(Math.max((now - this.prev) / 1000, 0), 0.05);
    this.prev = now;
    this.pendingWake = false;
    this.framesRun += 1;
    this.loop(dt, now);
    if (this.running && (this.mode === "continuous" || this.pendingWake)) {
      this.ensureRaf();
    }
  }
}
