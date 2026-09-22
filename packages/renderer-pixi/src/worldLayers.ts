import type { Container } from "pixi.js";
import { ActorLayer } from "./ActorLayer.ts";
import { TileLayer } from "./TileLayer.ts";
import { UnderlayLayer } from "./UnderlayLayer.ts";

/** Tile, then underlay (water), then actors. Hulls draw above the river band. */
export function attachWorldLayers(world: Container): {
  tiles: TileLayer;
  underlay: UnderlayLayer;
  actors: ActorLayer;
} {
  const tiles = new TileLayer(world);
  const underlay = new UnderlayLayer(world);
  const actors = new ActorLayer(world);
  return { tiles, underlay, actors };
}
