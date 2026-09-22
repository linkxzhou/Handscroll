import { Container, Graphics } from "pixi.js";
import type { UnderlayBand } from "@handscroll/core";

/**
 * Translucent bands between the tile layer and the actor layer.
 * Vessel hulls stay in the actor layer, so they draw above this water.
 */
export class UnderlayLayer {
  readonly container: Container;
  private readonly graphics: Graphics[] = [];

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = "underlay-layer";
    this.container.eventMode = "none";
    parent.addChild(this.container);
  }

  setBands(bands: readonly UnderlayBand[] | null): void {
    const list = bands ?? [];
    while (this.graphics.length < list.length) {
      const graphic = new Graphics();
      graphic.eventMode = "none";
      this.container.addChild(graphic);
      this.graphics.push(graphic);
    }
    for (let i = 0; i < this.graphics.length; i += 1) {
      const graphic = this.graphics[i]!;
      const band = list[i];
      graphic.clear();
      if (!band || band.w <= 0 || band.h <= 0) {
        graphic.visible = false;
        continue;
      }
      graphic.visible = true;
      const wave = band.time == null ? 0.5 : 0.5 + 0.5 * Math.sin(band.time * 1.3);
      const alpha = 0.22 + wave * 0.1;
      graphic.rect(band.x, band.y, band.w, band.h).fill({ color: 0x2a5660, alpha });
    }
  }

  clear(): void {
    this.setBands(null);
  }
}
