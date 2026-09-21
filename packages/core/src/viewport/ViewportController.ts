import type {
  FlyToOptions,
  SceneMeta,
  ViewportController as ViewportControllerContract,
  ViewportState,
} from "../contracts/viewport.ts";

export interface ViewportLimits {
  minZoom: number;
  maxZoom: number;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraTransition {
  fromX: number;
  fromY: number;
  fromZoom: number;
  toX: number;
  toY: number;
  toZoom: number;
  elapsed: number;
  duration: number;
}

export class ViewportController implements ViewportControllerContract {
  private centerX: number;
  private centerY: number;
  private zoom: number;
  private screenWidth: number;
  private screenHeight: number;
  private sceneMeta: SceneMeta | null = null;
  private limits: ViewportLimits = { minZoom: 0.02, maxZoom: 8 };
  private transition: CameraTransition | null = null;
  private vx = 0;
  private vy = 0;
  private friction = 4.5;

  constructor(initial?: Partial<ViewportState>) {
    this.centerX = initial?.centerX ?? 0;
    this.centerY = initial?.centerY ?? 0;
    this.zoom = initial?.zoom ?? 1;
    this.screenWidth = initial?.screenWidth ?? 1;
    this.screenHeight = initial?.screenHeight ?? 1;
  }

  getState(): ViewportState {
    return {
      centerX: this.centerX,
      centerY: this.centerY,
      zoom: this.zoom,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
    };
  }

  setLimits(limits: Partial<ViewportLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  setScene(meta: SceneMeta | null): void {
    this.sceneMeta = meta;
    if (meta) {
      const fit = Math.min(this.screenWidth / meta.width, this.screenHeight / meta.height);
      this.limits = {
        minZoom: Math.max(fit * 0.85, 0.02),
        maxZoom: this.limits.maxZoom,
      };
      this.clampToScene(meta);
    }
  }

  setSize(w: number, h: number): void {
    this.screenWidth = w;
    this.screenHeight = h;
    if (this.sceneMeta) this.setScene(this.sceneMeta);
  }

  setCenter(centerX: number, centerY: number, zoom?: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    if (zoom !== undefined) this.zoom = clamp(zoom, this.limits.minZoom, this.limits.maxZoom);
    if (this.sceneMeta) this.clampToScene(this.sceneMeta);
  }

  panByScreen(dx: number, dy: number): void {
    if (this.zoom === 0) return;
    this.centerX -= dx / this.zoom;
    this.centerY -= dy / this.zoom;
    if (this.sceneMeta) this.clampToScene(this.sceneMeta);
  }

  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  zoomAtScreen(factor: number, screenX: number, screenY: number): void {
    const world = this.screenToWorld(screenX, screenY);
    const nextZoom = clamp(this.zoom * factor, this.limits.minZoom, this.limits.maxZoom);
    if (nextZoom === this.zoom) return;
    this.zoom = nextZoom;
    this.centerX = world.x - (screenX - this.screenWidth / 2) / this.zoom;
    this.centerY = world.y - (screenY - this.screenHeight / 2) / this.zoom;
    if (this.sceneMeta) this.clampToScene(this.sceneMeta);
  }

  clampToScene(meta: SceneMeta): void {
    this.sceneMeta = meta;
    const visW = this.screenWidth / this.zoom;
    const visH = this.screenHeight / this.zoom;

    if (visW >= meta.width) {
      this.centerX = meta.width / 2;
    } else {
      this.centerX = clamp(this.centerX, visW / 2, meta.width - visW / 2);
    }

    if (visH >= meta.height) {
      this.centerY = meta.height / 2;
    } else {
      this.centerY = clamp(this.centerY, visH / 2, meta.height - visH / 2);
    }
  }

  flyTo(opts: FlyToOptions): void {
    this.vx = 0;
    this.vy = 0;
    this.transition = {
      fromX: this.centerX,
      fromY: this.centerY,
      fromZoom: this.zoom,
      toX: opts.centerX,
      toY: opts.centerY,
      toZoom: clamp(opts.zoom, this.limits.minZoom, this.limits.maxZoom),
      elapsed: 0,
      duration: Math.max(0, opts.duration),
    };
    if (this.transition.duration === 0) {
      this.centerX = this.transition.toX;
      this.centerY = this.transition.toY;
      this.zoom = this.transition.toZoom;
      if (this.sceneMeta) this.clampToScene(this.sceneMeta);
      this.transition = null;
    }
  }

  interruptTransition(): void {
    this.transition = null;
    this.vx = 0;
    this.vy = 0;
  }

  isAnimating(): boolean {
    return this.transition !== null || this.vx !== 0 || this.vy !== 0;
  }

  update(dt: number): void {
    if (this.transition) {
      if (this.transition.duration <= 0) {
        this.transition = null;
      } else {
        this.transition.elapsed += dt * 1000;
        const t = Math.min(1, this.transition.elapsed / this.transition.duration);
        const k = easeInOutCubic(t);
        this.centerX = this.transition.fromX + (this.transition.toX - this.transition.fromX) * k;
        this.centerY = this.transition.fromY + (this.transition.toY - this.transition.fromY) * k;
        this.zoom = this.transition.fromZoom + (this.transition.toZoom - this.transition.fromZoom) * k;
        if (this.sceneMeta) this.clampToScene(this.sceneMeta);
        if (t >= 1) this.transition = null;
      }
      return;
    }

    if (this.vx !== 0 || this.vy !== 0) {
      this.panByScreen(this.vx * dt, this.vy * dt);
      const decay = Math.exp(-this.friction * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 8) {
        this.vx = 0;
        this.vy = 0;
      }
    }
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.screenWidth / 2) / this.zoom + this.centerX,
      y: (sy - this.screenHeight / 2) / this.zoom + this.centerY,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.centerX) * this.zoom + this.screenWidth / 2,
      y: (wy - this.centerY) * this.zoom + this.screenHeight / 2,
    };
  }

  visibleWorldRect(preloadScreens = 0): { left: number; top: number; right: number; bottom: number } {
    const padX = (this.screenWidth / this.zoom) * preloadScreens;
    const padY = (this.screenHeight / this.zoom) * preloadScreens;
    const halfW = this.screenWidth / (2 * this.zoom);
    const halfH = this.screenHeight / (2 * this.zoom);
    return {
      left: this.centerX - halfW - padX,
      top: this.centerY - halfH - padY,
      right: this.centerX + halfW + padX,
      bottom: this.centerY + halfH + padY,
    };
  }
}
