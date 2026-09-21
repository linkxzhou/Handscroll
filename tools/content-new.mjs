#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const id = arg("--id");
const title = arg("--title") ?? id;
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error("Usage: yarn content:new --id my-scroll --title \"My Scroll\"");
  process.exit(1);
}

const dest = path.join(repoRoot, "contents", id);
try {
  await fs.access(dest);
  console.error(`contents/${id} already exists`);
  process.exit(1);
} catch {
  /* ok */
}

const template = path.join(repoRoot, "contents", "_template");
await fs.cp(template, dest, { recursive: true });

const metaPath = path.join(dest, "meta.json");
const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
meta.id = id;
meta.title = title;
await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n");

const scenePath = path.join(dest, "scene.json");
try {
  const scene = JSON.parse(await fs.readFile(scenePath, "utf8"));
  scene.meta.id = id;
  await fs.writeFile(scenePath, JSON.stringify(scene, null, 2) + "\n");
} catch {
  /* template may omit scene */
}

console.log(`Created contents/${id}. Place a long image at contents/${id}/raw/background.png then run yarn content:tiles --id ${id}`);
