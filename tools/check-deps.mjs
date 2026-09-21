#!/usr/bin/env node
/**
 * Architecture gate: @handscroll/core must not import pixi.js or three,
 * and core/plugins must stay painting-agnostic.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(root, "packages", "core");
const pluginsDir = path.join(root, "packages", "plugins");
const bannedImport = /\bfrom\s+['"](pixi\.js|three)['"]|\bimport\s+['"](pixi\.js|three)['"]|\brequire\(['"](pixi\.js|three)['"]\)/;
const bannedStory = /清明上河|虹桥|虹橋|qingming/i;

const importOffenders = [];
const storyOffenders = [];

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, onFile);
    } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name)) {
      onFile(full, fs.readFileSync(full, "utf8"));
    }
  }
}

walk(coreDir, (full, src) => {
  const rel = path.relative(root, full);
  if (bannedImport.test(src)) importOffenders.push(rel);
  if (bannedStory.test(src)) storyOffenders.push(rel);
});

walk(pluginsDir, (full, src) => {
  const rel = path.relative(root, full);
  if (bannedStory.test(src)) storyOffenders.push(rel);
});

if (importOffenders.length) {
  console.error("packages/core must not import pixi.js or three:");
  for (const f of importOffenders) console.error(`  - ${f}`);
}
if (storyOffenders.length) {
  console.error("packages/core and packages/plugins must not hard-code painting story:");
  for (const f of storyOffenders) console.error(`  - ${f}`);
}
if (importOffenders.length || storyOffenders.length) process.exit(1);

console.log("test:dep OK — packages/core has no pixi.js / three imports; core/plugins stay painting-agnostic");
