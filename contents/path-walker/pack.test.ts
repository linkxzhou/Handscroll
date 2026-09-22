import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SceneSchema, toSceneV2 } from "@handscroll/scene";
import { validateContentPack } from "../../tools/scene-validator/src/validate.ts";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe("path-walker fixture", () => {
  it("is a version 2 scene with one path-following sprite", async () => {
    const result = await validateContentPack(packDir);
    expect(result.issues).toEqual([]);
    const scene = SceneSchema.parse(JSON.parse(fs.readFileSync(path.join(packDir, "scene.json"), "utf8")));
    expect(scene.version).toBe(2);
    if (scene.version !== 2) return;
    expect(scene.actors).toHaveLength(1);
    expect(scene.actors[0]?.pathId).toBe("lane");
    expect(scene.actors[0]?.imageUrl).toBe("./atlas/walker.png");
    expect(toSceneV2(scene).paths[0]?.points.length).toBeGreaterThanOrEqual(2);
  });
});
