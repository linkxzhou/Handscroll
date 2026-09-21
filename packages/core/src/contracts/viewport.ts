export interface SceneMeta {
  id: string;
  width: number;
  height: number;
}

export interface ViewportState {
  centerX: number;
  centerY: number;
  /** CSS pixels per world unit. */
  zoom: number;
  screenWidth: number;
  screenHeight: number;
}

export interface FlyToOptions {
  centerX: number;
  centerY: number;
  zoom: number;
  duration: number;
}

export interface ViewportController {
  getState(): ViewportState;
  setSize(w: number, h: number): void;
  panByScreen(dx: number, dy: number): void;
  zoomAtScreen(factor: number, screenX: number, screenY: number): void;
  clampToScene(meta: SceneMeta): void;
  flyTo(opts: FlyToOptions): void;
  update(dt: number): void;
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  worldToScreen(wx: number, wy: number): { x: number; y: number };
}
