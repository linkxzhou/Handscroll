import fs from "node:fs/promises";
import path from "node:path";
import { MetaSchema, SceneSchema } from "@handscroll/scene";
import { ZodError } from "zod";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export async function validateContentPack(contentDir: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const metaPath = path.join(contentDir, "meta.json");
  const scenePath = path.join(contentDir, "scene.json");
  const manifestPath = path.join(contentDir, "tiles", "manifest.json");

  let meta: ReturnType<typeof MetaSchema.parse> | null = null;
  let scene: ReturnType<typeof SceneSchema.parse> | null = null;

  try {
    meta = MetaSchema.parse(JSON.parse(await fs.readFile(metaPath, "utf8")));
  } catch (err) {
    issues.push({ path: "meta.json", message: formatErr(err) });
  }

  try {
    scene = SceneSchema.parse(JSON.parse(await fs.readFile(scenePath, "utf8")));
  } catch (err) {
    issues.push({ path: "scene.json", message: formatErr(err) });
  }

  let manifest: { width?: number; height?: number } | null = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as { width?: number; height?: number };
  } catch (err) {
    issues.push({ path: "tiles/manifest.json", message: formatErr(err) });
  }

  if (meta && scene) {
    if (meta.id !== scene.meta.id) {
      issues.push({ path: "scene.json.meta.id", message: `scene id "${scene.meta.id}" != meta.id "${meta.id}"` });
    }
    if (meta.width !== scene.meta.width) {
      issues.push({ path: "scene.json.meta.width", message: `scene width ${scene.meta.width} != meta.width ${meta.width}` });
    }
    if (meta.height !== scene.meta.height) {
      issues.push({ path: "scene.json.meta.height", message: `scene height ${scene.meta.height} != meta.height ${meta.height}` });
    }
    for (const entity of scene.entities) {
      if (entity.type !== "hotspot") continue;
      const inside = entity.x >= 0 && entity.y >= 0 && entity.x <= meta.width && entity.y <= meta.height;
      if (!inside) {
        issues.push({ path: `scene.json.entities.${entity.id}`, message: `hotspot origin (${entity.x}, ${entity.y}) is outside the world rect` });
      }
    }
  }

  if (meta && manifest?.width && manifest.width !== meta.width) {
    issues.push({ path: "tiles/manifest.json.width", message: `manifest.width ${manifest.width} != meta.width ${meta.width}` });
  }
  if (meta && manifest?.height && manifest.height !== meta.height) {
    issues.push({ path: "tiles/manifest.json.height", message: `manifest.height ${manifest.height} != meta.height ${meta.height}` });
  }

  const readme = path.join(contentDir, "raw", "README.md");
  try {
    const text = await fs.readFile(readme, "utf8");
    if (!text.trim()) issues.push({ path: "raw/README.md", message: "license/source README is empty" });
  } catch {
    issues.push({ path: "raw/README.md", message: "missing source/license notes" });
  }

  return { ok: issues.length === 0, issues };
}

function formatErr(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
