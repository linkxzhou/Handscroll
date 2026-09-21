import type { SceneDocument, SceneEntity } from "@handscroll/core";

export class EntityRegistry {
  private readonly byId = new Map<string, SceneEntity>();

  setAll(entities: readonly SceneEntity[]): void {
    this.byId.clear();
    for (const entity of entities) this.byId.set(entity.id, entity);
  }

  get(id: string): SceneEntity | undefined {
    return this.byId.get(id);
  }

  all(): SceneEntity[] {
    return [...this.byId.values()];
  }

  clear(): void {
    this.byId.clear();
  }
}

export function emptyScene(id: string, width: number, height: number): SceneDocument {
  return {
    version: 1,
    meta: { id, width, height },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: [],
    chapters: [],
  };
}
