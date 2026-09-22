import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bannedImport = /\bfrom\s+['"](pixi\.js|three)['"]|\bimport\s+['"](pixi\.js|three)['"]|\brequire\(['"](pixi\.js|three)['"]\)/;
const paintingName = /qingming|清明上河|茶市|虹桥/i;

describe("renderer imports W-D-01", () => {
  it("keeps pixi, three, and painting names out of core and world", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const hits: string[] = [];
    for (const pkg of ["core", "world"]) {
      walk(path.join(root, "packages", pkg), (file, src) => {
        if (bannedImport.test(src) || paintingName.test(src)) hits.push(path.relative(root, file));
      });
    }
    expect(hits).toEqual([]);
  });
});

function walk(dir: string, visit: (file: string, src: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, visit);
    } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      visit(full, fs.readFileSync(full, "utf8"));
    }
  }
}
