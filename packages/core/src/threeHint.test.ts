import { describe, expect, it } from "vitest";
import type { SceneDocument } from "./contracts/engine.ts";
import { sceneNeedsThree, THREE_PLUGIN_IDS } from "./threeHint.ts";

const scene = (entities: SceneDocument["entities"] = []): SceneDocument => ({
  version: 1,
  meta: { id: "x", width: 10, height: 10 },
  background: { manifestUrl: "./tiles/manifest.json" },
  entities,
  chapters: [],
});

describe("sceneNeedsThree", () => {
  it("is false for a 2D-only pack", () => {
    expect(sceneNeedsThree(scene([{ id: "h", type: "hotspot", x: 0, y: 0, shape: { kind: "rect", w: 1, h: 1 } }]))).toBe(
      false,
    );
    expect(sceneNeedsThree(scene(), ["quality", "guide"])).toBe(false);
  });

  it("is true when a model3d entity is present", () => {
    expect(sceneNeedsThree(scene([{ id: "box", type: "model3d", x: 1, y: 2, url: "primitive:box" }]))).toBe(true);
  });

  it("is true when a three-backed plugin id is enabled", () => {
    expect(THREE_PLUGIN_IDS.has("water")).toBe(true);
    expect(sceneNeedsThree(scene(), ["guide", "water"])).toBe(true);
  });
});
