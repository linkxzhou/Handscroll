import { describe, expect, it } from "vitest";
import { validateContentPack } from "./validate.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function writePack(overrides: {
  width?: number;
  sceneWidth?: number;
  hotspot?: { x: number; y: number };
  manifestWidth?: number;
}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "handscroll-"));
  await fs.mkdir(path.join(dir, "tiles"), { recursive: true });
  await fs.mkdir(path.join(dir, "raw"), { recursive: true });
  await fs.writeFile(path.join(dir, "raw", "README.md"), "license");
  const width = overrides.width ?? 100;
  const height = 50;
  await fs.writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({
      id: "x",
      title: "X",
      width,
      height,
      license: { assets: "test" },
    }),
  );
  await fs.writeFile(
    path.join(dir, "scene.json"),
    JSON.stringify({
      version: 1,
      meta: { id: "x", width: overrides.sceneWidth ?? width, height },
      background: { manifestUrl: "./tiles/manifest.json" },
      entities: overrides.hotspot
        ? [{ id: "out", type: "hotspot", x: overrides.hotspot.x, y: overrides.hotspot.y, shape: { kind: "rect", w: 1, h: 1 } }]
        : [],
      chapters: [],
    }),
  );
  await fs.writeFile(
    path.join(dir, "tiles", "manifest.json"),
    JSON.stringify({
      width: overrides.manifestWidth ?? width,
      height,
      tileSize: 64,
      levels: [{ id: "0", scale: 1 }],
      tileUrl: "{level}/{x}_{y}.webp",
    }),
  );
  return dir;
}

describe("scene-validator cross checks B-U-03/04", () => {
  it("fails when meta width does not match the tile manifest", async () => {
    const dir = await writePack({ width: 100, manifestWidth: 200 });
    const result = await validateContentPack(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("manifest.json.width"))).toBe(true);
  });

  it("fails when a hotspot sits outside the world rect (B-U-04)", async () => {
    const dir = await writePack({ hotspot: { x: 500, y: 0 } });
    const result = await validateContentPack(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("entities.out"))).toBe(true);
  });

  it("accepts the committed demo-scroll pack", async () => {
    const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../contents/demo-scroll");
    const result = await validateContentPack(demo);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")).toBe(true);
  });

  it("accepts the committed guide-only-scroll pack", async () => {
    const pack = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../contents/guide-only-scroll");
    const result = await validateContentPack(pack);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")).toBe(true);
  });
});
