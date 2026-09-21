/** Painting world (x right, y down) maps to Three (x, -y, z). */
export function paintingToThree(x: number, y: number, z = 0): { x: number; y: number; z: number } {
  return { x, y: -y, z };
}

export const DEFAULT_ANCHOR_SIZE = 80;
export const DEFAULT_ANCHOR_Z = DEFAULT_ANCHOR_SIZE / 2;
