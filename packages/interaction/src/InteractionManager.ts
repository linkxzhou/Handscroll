import type { AabbItem, SceneEntity } from "@handscroll/core";
import { hotspotItems, resolveHits } from "./pick.ts";
import { SpatialIndex } from "./SpatialIndex.ts";

export class InteractionManager {
  private entities: SceneEntity[] = [];
  private readonly index = new SpatialIndex();

  setEntities(entities: readonly SceneEntity[]): void {
    this.entities = [...entities];
    this.index.loadStatic(hotspotItems(this.entities));
  }

  sync(items: readonly AabbItem[]): void {
    this.index.loadDynamic(items);
  }

  pick(worldX: number, worldY: number) {
    return this.pickAll(worldX, worldY)[0] ?? null;
  }

  pickAll(worldX: number, worldY: number) {
    return resolveHits(this.index.queryPoint(worldX, worldY), this.entities, worldX, worldY);
  }
}
