import { Application, ColorMatrixFilter } from "pixi.js";
import type { ActorSnapshot, RendererAdapter, TileGrade, UnderlayBand, ViewportState, VisibleTile } from "@handscroll/core";
import { createWorldRoot } from "./WorldRoot.ts";
import { TileLayer } from "./TileLayer.ts";
import { ActorLayer } from "./ActorLayer.ts";
import { UnderlayLayer } from "./UnderlayLayer.ts";
import { applyTileGrade } from "./tileGrade.ts";
import { attachWorldLayers } from "./worldLayers.ts";

export function createPixiRenderer(): RendererAdapter {
  return new PixiRenderer();
}

class PixiRenderer implements RendererAdapter {
  readonly kind = "pixi" as const;
  private app: Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private world = createWorldRoot();
  private tiles: TileLayer | null = null;
  private underlay: UnderlayLayer | null = null;
  private actors: ActorLayer | null = null;
  private readonly tileFilter = new ColorMatrixFilter();
  private readonly actorFilter = new ColorMatrixFilter();
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
    const layers = attachWorldLayers(this.world);
    this.tiles = layers.tiles;
    this.underlay = layers.underlay;
    this.actors = layers.actors;
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
    this.world.scale.set(viewport.zoom);
    this.world.position.set(
      viewport.screenWidth / 2 - viewport.centerX * viewport.zoom,
      viewport.screenHeight / 2 - viewport.centerY * viewport.zoom,
    );
  }

  setTiles(tiles: readonly VisibleTile[]): void {
    this.tiles?.sync(tiles);
  }

  setActors(actors: readonly ActorSnapshot[]): void {
    this.actors?.setActors(actors);
  }

  setTileGrade(grade: TileGrade): void {
    if (!this.tiles || !this.actors) return;
    applyTileGrade(this.tiles.container, this.actors.container, grade, {
      tiles: this.tileFilter,
      actors: this.actorFilter,
    });
  }

  setUnderlay(bands: readonly UnderlayBand[] | null): void {
    this.underlay?.setBands(bands);
  }

  render(): void {
    this.app?.render();
  }

  destroy(): void {
    this.tiles?.clear();
    this.tiles = null;
    this.underlay?.clear();
    this.underlay = null;
    this.actors?.clear();
    this.actors = null;
    this.app?.destroy();
    this.app = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
