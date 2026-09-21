import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetaSchema, SceneSchema } from "@handscroll/scene";
import { validateContentPack } from "../../tools/scene-validator/src/validate.ts";
import { CHAPTERS, inWorld } from "./story/coords.ts";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe("qingming-riverside pack load Q-A-02", () => {
  it("passes content:validate and schema parse", async () => {
    const result = await validateContentPack(packDir);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const meta = MetaSchema.parse(JSON.parse(fs.readFileSync(path.join(packDir, "meta.json"), "utf8")));
    const scene = SceneSchema.parse(JSON.parse(fs.readFileSync(path.join(packDir, "scene.json"), "utf8")));
    expect(meta.id).toBe("qingming-riverside");
    expect(meta.width).toBe(6516);
    expect(meta.height).toBe(724);
    expect(meta.plugins).toEqual(["quality", "guide", "audio", "weather", "water"]);
    expect(meta.defaultViewport.centerX).toBe(3120);
    expect(scene.chapters.map((c) => c.id)).toEqual(["watermill", "teahouse", "bridge", "gate"]);
    expect(scene.entities.some((e) => e.id === "ferry-boat" && e.type === "sprite")).toBe(true);
    expect(scene.entities.some((e) => e.id === "bridge-event" && e.type === "hotspot")).toBe(true);
    expect(scene.entities.filter((e) => e.id.startsWith("dock-")).map((e) => e.id).sort()).toEqual(["dock-east", "dock-west"]);
  });

  it("keeps chapter flyTo targets on the stitch and aligned with coords.ts", () => {
    const scene = SceneSchema.parse(JSON.parse(fs.readFileSync(path.join(packDir, "scene.json"), "utf8")));
    for (const chapter of scene.chapters) {
      expect(inWorld(chapter.centerX, chapter.centerY)).toBe(true);
      const expected = CHAPTERS[chapter.id as keyof typeof CHAPTERS];
      expect(chapter.centerX).toBe(expected.centerX);
      expect(chapter.centerY).toBe(expected.centerY);
    }
  });

  it("does not hard-code qingming business into packages/core (Q-R-01)", () => {
    const coreDir = path.resolve(packDir, "../../packages/core");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(full);
        } else if (/\.(ts|js)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/qingming/i.test(src)) hits.push(path.relative(coreDir, full));
        }
      }
    };
    walk(coreDir);
    expect(hits).toEqual([]);
  });

  it("does not hard-code qingming business into packages/plugins (P-R-01)", () => {
    const pluginsDir = path.resolve(packDir, "../../packages/plugins");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(full);
        } else if (/\.(ts|js|md)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/qingming|虹桥/i.test(src)) hits.push(path.relative(pluginsDir, full));
        }
      }
    };
    walk(pluginsDir);
    expect(hits).toEqual([]);
  });
});
