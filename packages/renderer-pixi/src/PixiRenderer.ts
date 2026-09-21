import { Application } from "pixi.js";
import type { RendererAdapter, ViewportState, VisibleTile } from "@handscroll/core";
import { createWorldRoot } from "./WorldRoot.ts";
import { TileLayer } from "./TileLayer.ts";
import { worldRootTransform } from "./worldTransform.ts";

export function createPixiRenderer(): RendererAdapter {
  return new PixiRenderer();
}

class PixiRenderer implements RendererAdapter {
  readonly kind = "pixi" as const;
  private app: Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private world = createWorldRoot();
  private tiles: TileLayer | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;

  async mount(container: HTMLElement): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.className = "pixi-layer";
    container.appendChild(canvas);
    this.canvas = canvas;

    const app = new Application();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.width = width;
    this.height = height;
    await app.init({
      canvas,
      width,
      height,
      autoStart: false,
      background: "#1b140f",
      antialias: false,
      resolution: this.dpr,
      autoDensity: true,
      powerPreference: "high-performance",
    });
    this.app = app;
    app.stage.addChild(this.world);
    this.tiles = new TileLayer(this.world);
    return canvas;
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = dpr;
    if (!this.app) return;
    const renderer = this.app.renderer;
    renderer.resolution = dpr;
    renderer.resize(this.width, this.height);
  }

  sync(viewport: ViewportState): void {
    const pose = worldRootTransform(viewport);
    this.world.scale.set(pose.scale);
    this.world.position.set(pose.x, pose.y);
  }

  setTiles(tiles: readonly VisibleTile[]): void {
    this.tiles?.sync(tiles);
  }

  render(): void {
    this.app?.render();
  }

  destroy(): void {
    this.tiles?.clear();
    this.tiles = null;
    this.app?.destroy();
    this.app = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
