import { Container } from "pixi.js";

export function createWorldRoot(): Container {
  const world = new Container();
  world.label = "world-root";
  world.eventMode = "none";
  return world;
}
