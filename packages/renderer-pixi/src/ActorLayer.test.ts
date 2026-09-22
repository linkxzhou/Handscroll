import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import { ViewportController } from "@handscroll/core";
import type { ActorSnapshot } from "@handscroll/core";
import { ActorLayer } from "./ActorLayer.ts";

function actor(partial: Partial<ActorSnapshot> = {}): ActorSnapshot {
  return {
    id: "walker",
    x: 100,
    y: 40,
    zIndex: 1,
    visible: true,
    kind: "sprite",
    width: 16,
    height: 24,
    anchorX: 0.5,
    anchorY: 1,
    ...partial,
  };
}

function syncWorld(world: Container, centerX: number, centerY: number, zoom: number, screenWidth: number, screenHeight: number) {
  world.scale.set(zoom);
  world.position.set(screenWidth / 2 - centerX * zoom, screenHeight / 2 - centerY * zoom);
}

describe("ActorLayer", () => {
  it("matches worldToScreen within 1px at zoom 1 and stays glued when zoom changes (W-I-01)", () => {
    const world = new Container();
    const layer = new ActorLayer(world);
    const sprite = actor();
    layer.setActors([sprite]);
    const camera = new ViewportController({
      centerX: 80,
      centerY: 20,
      zoom: 1,
      screenWidth: 200,
      screenHeight: 100,
    });

    const check = () => {
      const vp = camera.getState();
      syncWorld(world, vp.centerX, vp.centerY, vp.zoom, vp.screenWidth, vp.screenHeight);
      const node = layer.container.children[0];
      expect(node).toBeTruthy();
      const global = node!.getGlobalPosition();
      const screen = camera.worldToScreen(sprite.x, sprite.y);
      expect(Math.abs(global.x - screen.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(global.y - screen.y)).toBeLessThanOrEqual(1);
    };

    check();
    camera.zoomAtScreen(2, 100, 50);
    check();
  });

  it("removes every actor node when setActors is empty (W-I-02)", () => {
    const world = new Container();
    const layer = new ActorLayer(world);
    layer.setActors([actor(), actor({ id: "other", x: 4, y: 8 })]);
    expect(layer.container.children.length).toBe(2);
    layer.setActors([]);
    expect(layer.container.children.length).toBe(0);
    expect(world.children[0]?.label).toBe("actor-layer");
    expect(world.children[0]?.children.length).toBe(0);
  });
});
