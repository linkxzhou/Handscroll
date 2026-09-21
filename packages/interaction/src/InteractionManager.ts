import type { SceneEntity } from "@handscroll/core";
import { pick, pickAll } from "./pick.ts";

/** Minimal AABB list. Flatbush can replace this later without changing callers. */
export class FlatbushIndex {
  private entities: SceneEntity[] = [];

  load(entities: readonly SceneEntity[]): void {
    this.entities = [...entities];
  }

  query(worldX: number, worldY: number): SceneEntity[] {
    return this.entities.filter((e) => {
      if (e.type !== "hotspot") return false;
      const shape = e.shape;
      if (shape.kind === "rect") {
        return worldX >= e.x && worldY >= e.y && worldX <= e.x + shape.w && worldY <= e.y + shape.h;
      }
      if (shape.kind === "circle") {
        return (worldX - e.x) ** 2 + (worldY - e.y) ** 2 <= shape.r ** 2;
      }
      return true;
    });
  }
}

export class InteractionManager {
  private entities: SceneEntity[] = [];
  private readonly index = new FlatbushIndex();

  setEntities(entities: readonly SceneEntity[]): void {
    this.entities = [...entities];
    this.index.load(this.entities);
  }

  pick(worldX: number, worldY: number) {
    return pick(worldX, worldY, this.entities);
  }

  pickAll(worldX: number, worldY: number) {
    return pickAll(worldX, worldY, this.entities);
  }
}
