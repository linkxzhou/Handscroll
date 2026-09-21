import { describe, expect, it } from "vitest";
import { MetaSchema, SceneSchema } from "./schema.ts";

const license = { assets: "CC0 test fixture" };

describe("schemas B-U-01/02", () => {
  it("rejects meta without license.assets (B-U-01)", () => {
    const result = MetaSchema.safeParse({
      id: "demo-scroll",
      title: "Demo",
      width: 10,
      height: 10,
      license: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown entity types (B-U-02)", () => {
    const result = SceneSchema.safeParse({
      version: 1,
      meta: { id: "demo-scroll", width: 10, height: 10 },
      background: { manifestUrl: "./tiles/manifest.json" },
      entities: [{ id: "x", type: "ferry", x: 0, y: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid meta and empty scene", () => {
    const meta = MetaSchema.parse({
      id: "demo-scroll",
      title: "Demo",
      width: 4096,
      height: 1024,
      plugins: ["quality", "guide"],
      license,
    });
    expect(meta.plugins).toEqual(["quality", "guide"]);
    expect(meta.storyEntry).toBe("./story/index.ts");

    const scene = SceneSchema.parse({
      version: 1,
      meta: { id: "demo-scroll", width: 4096, height: 1024 },
      background: { manifestUrl: "./tiles/manifest.json" },
    });
    expect(scene.entities).toEqual([]);
    expect(scene.chapters).toEqual([]);
  });

  it("accepts hotspot, sprite, and chapter fields", () => {
    const scene = SceneSchema.parse({
      version: 1,
      meta: { id: "demo-scroll", width: 100, height: 50 },
      background: { manifestUrl: "./tiles/manifest.json" },
      entities: [
        {
          id: "gate",
          type: "hotspot",
          x: 10,
          y: 10,
          shape: { kind: "rect", w: 20, h: 10 },
          action: { type: "openPanel", payload: { title: "Gate" } },
        },
        { id: "boat", type: "sprite", x: 1, y: 2, url: "boat.png" },
        { id: "anchor-box", type: "model3d", x: 40, y: 20, url: "primitive:box" },
      ],
      chapters: [{ id: "start", title: "Start", centerX: 50, centerY: 25, zoom: 0.5 }],
    });
    expect(scene.entities).toHaveLength(3);
    expect(scene.chapters[0]?.id).toBe("start");
  });

  it("rejects a meta id that is not kebab-case", () => {
    const result = MetaSchema.safeParse({
      id: "Qing Ming",
      title: "No",
      width: 10,
      height: 10,
      license,
    });
    expect(result.success).toBe(false);
  });
});
