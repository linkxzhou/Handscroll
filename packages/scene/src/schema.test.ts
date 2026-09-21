import { describe, expect, it } from "vitest";
import { MetaSchema, SceneSchema } from "./schema.ts";

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
});
