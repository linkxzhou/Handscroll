#!/usr/bin/env node
/**
 * Architecture gate: @handscroll/core must not import pixi.js or three.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(root, "packages", "core");
const banned = /\bfrom\s+['"](pixi\.js|three)['"]|\bimport\s+['"](pixi\.js|three)['"]|\brequire\(['"](pixi\.js|three)['"]\)/;

const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full);
    } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name)) {
      const src = fs.readFileSync(full, "utf8");
      if (banned.test(src)) offenders.push(path.relative(root, full));
    }
  }
}

walk(coreDir);

if (offenders.length) {
  console.error("packages/core must not import pixi.js or three:");
  for (const f of offenders) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("test:dep OK — packages/core has no pixi.js / three imports");
