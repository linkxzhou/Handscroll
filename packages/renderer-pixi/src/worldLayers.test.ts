import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import type { ColorMatrixFilter } from "pixi.js";
import { applyTileGrade, type NightGradeFilter } from "./tileGrade.ts";
import { attachWorldLayers } from "./worldLayers.ts";

function stubFilter(): ColorMatrixFilter {
  const filter: NightGradeFilter = {
    reset() {},
    brightness() {},
    tint() {},
  };
  return filter as ColorMatrixFilter;
}

describe("pixi world layers", () => {
  it("draws the underlay above tiles and below actors", () => {
    const world = new Container();
    const layers = attachWorldLayers(world);
    expect(world.children.map((child) => child.label)).toEqual(["tile-layer", "underlay-layer", "actor-layer"]);
    layers.underlay.setBands([{ x: 0, y: 10, w: 40, h: 12, time: 0 }]);
    expect(layers.underlay.container.children.length).toBe(1);
    const band = layers.underlay.container.children[0];
    expect(band?.visible).toBe(true);
    layers.underlay.setBands(null);
    expect(band?.visible).toBe(false);
  });

  it("applies night to the tile container only unless actors are included", () => {
    const tiles = new Container();
    const actors = new Container();
    const filters = { tiles: stubFilter(), actors: stubFilter() };
    applyTileGrade(tiles, actors, { darkness: 0.55 }, filters);
    expect(tiles.filters?.length).toBe(1);
    expect(actors.filters).toBeNull();
    applyTileGrade(tiles, actors, { darkness: 0.55, gradeActors: true }, filters);
    expect(actors.filters?.length).toBe(1);
    applyTileGrade(tiles, actors, { darkness: 0 }, filters);
    expect(tiles.filters).toBeNull();
    expect(actors.filters).toBeNull();
  });
});