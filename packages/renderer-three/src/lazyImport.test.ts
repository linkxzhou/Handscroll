import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLazyThreeRenderer } from "./createLazyThree.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("lazy Three adapter", () => {
  it("does not statically import three.js (chunk stays behind ensureLoaded)", () => {
    const src = fs.readFileSync(path.join(dir, "createLazyThree.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']three["']/);
    expect(src).toMatch(/import\("\.\/ThreeRenderer\.ts"\)/);
    const index = fs.readFileSync(path.join(dir, "index.ts"), "utf8");
    expect(index).not.toMatch(/from\s+["']three["']/);
  });

  it("stays unloaded until ensureLoaded", () => {
    const adapter = createLazyThreeRenderer();
    expect(adapter.needsThree?.()).toBe(false);
    adapter.setSceneEntities?.([{ id: "box", type: "model3d", x: 8, y: 4, url: "primitive:box" }]);
    expect(adapter.needsThree?.()).toBe(false);
    adapter.destroy();
  });
});
