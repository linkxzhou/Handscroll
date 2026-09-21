import { Container, Sprite, Texture } from "pixi.js";
import type { VisibleTile } from "@handscroll/core";

export class TileLayer {
  readonly container: Container;
  private readonly sprites = new Map<string, Sprite>();

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = "tile-layer";
    this.container.eventMode = "none";
    parent.addChild(this.container);
  }

  sync(tiles: readonly VisibleTile[]): void {
    const seen = new Set<string>();
    for (const tile of tiles) {
      if (!tile.ready || !tile.bitmap) continue;
      seen.add(tile.key);
      let sprite = this.sprites.get(tile.key);
      if (!sprite) {
        const texture = Texture.from(tile.bitmap);
        sprite = new Sprite(texture);
        sprite.eventMode = "none";
        this.sprites.set(tile.key, sprite);
        this.container.addChild(sprite);
      }
      sprite.position.set(tile.worldX, tile.worldY);
      sprite.width = tile.worldWidth;
      sprite.height = tile.worldHeight;
    }
    for (const [key, sprite] of this.sprites) {
      if (seen.has(key)) continue;
      this.container.removeChild(sprite);
      sprite.destroy({ texture: false });
      this.sprites.delete(key);
    }
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy({ texture: false });
    }
    this.sprites.clear();
    this.container.removeChildren();
  }
}
