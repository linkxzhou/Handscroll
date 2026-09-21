import { describe, expect, it } from "vitest";
import { validateContentPack } from "./validate.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("scene-validator cross checks B-U-03", () => {
  it("fails when meta width does not match the tile manifest", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "handscroll-"));
    await fs.mkdir(path.join(dir, "tiles"), { recursive: true });
    await fs.mkdir(path.join(dir, "raw"), { recursive: true });
    await fs.writeFile(path.join(dir, "raw", "README.md"), "license");
    await fs.writeFile(
      path.join(dir, "meta.json"),
      JSON.stringify({
        id: "x",
        title: "X",
        width: 100,
        height: 50,
        license: { assets: "test" },
      }),
    );
    await fs.writeFile(
      path.join(dir, "scene.json"),
      JSON.stringify({
        version: 1,
        meta: { id: "x", width: 100, height: 50 },
        background: { manifestUrl: "./tiles/manifest.json" },
        entities: [],
        chapters: [],
      }),
    );
    await fs.writeFile(
      path.join(dir, "tiles", "manifest.json"),
      JSON.stringify({ width: 200, height: 50, tileSize: 64, levels: [{ id: "0", scale: 1 }], tileUrl: "{level}/{x}_{y}.webp" }),
    );
    const result = await validateContentPack(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("manifest.json.width"))).toBe(true);
  });
});
