import type { SceneEntity } from "@handscroll/core";
import { DEFAULT_ANCHOR_Z, paintingToThree } from "./worldMap.ts";

export interface Model3dAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
}

export function model3dAnchorsFromEntities(entities: readonly SceneEntity[]): Model3dAnchor[] {
  const anchors: Model3dAnchor[] = [];
  for (const entity of entities) {
    if (entity.type !== "model3d") continue;
    const pose = paintingToThree(entity.x, entity.y, DEFAULT_ANCHOR_Z);
    anchors.push({ id: entity.id, ...pose });
  }
  return anchors;
}
