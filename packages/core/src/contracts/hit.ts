export type HitRenderer = "pixi" | "three" | "dom";

export interface HitResult {
  entityId: string;
  renderer: HitRenderer;
  interactionPriority: number;
  worldX: number;
  worldY: number;
}
