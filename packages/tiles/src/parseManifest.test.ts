import { describe, expect, it } from "vitest";
import { parseManifest, tileUrl } from "./parseManifest.ts";

describe("parseManifest", () => {
  it("parses and sorts levels by scale", () => {
    const m = parseManifest({
      width: 1024,
      height: 512,
      tileSize: 256,
      levels: [
        { id: "hi", scale: 1 },
        { id: "lo", scale: 0.25 },
      ],
      tileUrl: "{level}/{x}_{y}.webp",
    });
    expect(m.levels.map((l) => l.id)).toEqual(["lo", "hi"]);
    expect(tileUrl(m, "hi", 3, 1)).toBe("hi/3_1.webp");
  });

  it("rejects a non-object and a missing level list", () => {
    expect(() => parseManifest(null)).toThrow(/must be an object/);
    expect(() => parseManifest({ width: 10, height: 10, tileSize: 8, levels: [] })).toThrow(/levels/);
    expect(() => parseManifest({ width: 0, height: 10, tileSize: 8, levels: [{ id: "0", scale: 1 }] })).toThrow(/width/);
  });
});
