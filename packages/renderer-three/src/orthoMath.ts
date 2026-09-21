import type { ViewportState } from "@handscroll/core";

export interface OrthoCameraPose {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

/** Painting (x, y) maps to Three (x, -y, z). */
export function orthoCameraFromViewport(viewport: ViewportState, distance = 1000): OrthoCameraPose {
  const visW = viewport.screenWidth / viewport.zoom;
  const visH = viewport.screenHeight / viewport.zoom;
  return {
    left: -visW / 2,
    right: visW / 2,
    top: visH / 2,
    bottom: -visH / 2,
    near: 0.1,
    far: distance * 4,
    position: { x: viewport.centerX, y: -viewport.centerY, z: distance },
    lookAt: { x: viewport.centerX, y: -viewport.centerY, z: 0 },
  };
}
