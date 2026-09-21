import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetaSchema } from "@handscroll/scene";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const idx = process.argv.findIndex((a) => a === "--content" || a === "--id");
const id = idx >= 0 ? process.argv[idx + 1] : undefined;
if (!id) {
  console.error("Usage: pnpm content:scaffold-scene -- --id demo-scroll");
  process.exit(1);
}

const contentDir = path.join(repoRoot, "contents", id);
const scenePath = path.join(contentDir, "scene.json");
const force = process.argv.includes("--force");

try {
  await fs.access(scenePath);
  if (!force) {
    console.log(`scene.json already exists for ${id} (pass --force to overwrite)`);
    process.exit(0);
  }
} catch {
  /* create */
}

const meta = MetaSchema.parse(JSON.parse(await fs.readFile(path.join(contentDir, "meta.json"), "utf8")));
const scene = {
  version: 1,
  meta: { id: meta.id, width: meta.width, height: meta.height },
  background: { manifestUrl: "./tiles/manifest.json" },
  entities: [],
  chapters: meta.defaultViewport
    ? [
        {
          id: "start",
          title: "Start",
          centerX: meta.defaultViewport.centerX,
          centerY: meta.defaultViewport.centerY,
          zoom: meta.defaultViewport.zoom,
        },
      ]
    : [],
};

await fs.writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
console.log(`Wrote ${scenePath}`);
