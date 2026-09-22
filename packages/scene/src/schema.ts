import { z } from "zod";

export const MetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  era: z.string().optional(),
  description: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  defaultViewport: z
    .object({
      centerX: z.number(),
      centerY: z.number(),
      zoom: z.number().positive(),
    })
    .optional(),
  plugins: z.array(z.string()).default([]),
  pluginConfig: z.record(z.unknown()).optional(),
  storyEntry: z.string().default("./story/index.ts"),
  license: z.object({
    code: z.string().optional(),
    assets: z.string(),
    notes: z.string().optional(),
  }),
});

export type MetaDocument = z.infer<typeof MetaSchema>;

const RectShape = z.object({ kind: z.literal("rect"), w: z.number(), h: z.number() });
const CircleShape = z.object({ kind: z.literal("circle"), r: z.number() });
const PolygonShape = z.object({
  kind: z.literal("polygon"),
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
});

export const HotspotSchema = z.object({
  id: z.string(),
  type: z.literal("hotspot"),
  x: z.number(),
  y: z.number(),
  shape: z.union([RectShape, CircleShape, PolygonShape]),
  zIndex: z.number().optional(),
  interactionPriority: z.number().optional(),
  action: z
    .object({
      type: z.enum(["openPanel", "emit", "flyTo", "none"]),
      payload: z.unknown().optional(),
    })
    .optional(),
  i18nKey: z.string().optional(),
  ownerPluginId: z.string().optional(),
});

const SpriteSchema = z.object({
  id: z.string(),
  type: z.literal("sprite"),
  x: z.number(),
  y: z.number(),
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  zIndex: z.number().optional(),
  ownerPluginId: z.string().optional(),
});

const AnimationSchema = z.object({
  id: z.string(),
  type: z.literal("animation"),
  x: z.number(),
  y: z.number(),
  atlas: z.string().optional(),
  zIndex: z.number().optional(),
  ownerPluginId: z.string().optional(),
});

const Model3dSchema = z.object({
  id: z.string(),
  type: z.literal("model3d"),
  x: z.number(),
  y: z.number(),
  url: z.string(),
  zIndex: z.number().optional(),
  ownerPluginId: z.string().optional(),
});

const sceneCommon = {
  meta: z.object({
    id: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  background: z.object({
    manifestUrl: z.string(),
  }),
  entities: z.array(z.discriminatedUnion("type", [SpriteSchema, AnimationSchema, HotspotSchema, Model3dSchema])).default([]),
  chapters: z
    .array(
      z.object({
        id: z.string(),
        titleKey: z.string().optional(),
        title: z.string().optional(),
        centerX: z.number(),
        centerY: z.number(),
        zoom: z.number(),
      }),
    )
    .default([]),
};

/**
 * Phase 0 keeps version 2 arrays opaque.
 * Element schemas (path / actor / zone / spawn / dialogue / trigger) are Phase 1.
 * Unknown keys on the document are stripped, not rejected (Zod's default).
 */
const deferredWorldArray = () => z.array(z.unknown()).default([]);

/** Published v1 shape. World arrays are not part of this document and are stripped. */
export const SceneSchemaV1 = z.object({
  version: z.literal(1),
  ...sceneCommon,
});

/**
 * Version 2 is a superset of v1 (ADR 0004).
 * Missing world arrays default to `[]`. Elements are preserved and not interpreted.
 */
export const SceneSchemaV2 = SceneSchemaV1.extend({
  version: z.literal(2),
  paths: deferredWorldArray(),
  actors: deferredWorldArray(),
  zones: deferredWorldArray(),
  spawns: deferredWorldArray(),
  dialogues: deferredWorldArray(),
  triggers: deferredWorldArray(),
});

export type SceneJson = z.infer<typeof SceneSchemaV1> | z.infer<typeof SceneSchemaV2>;

/**
 * Accepts scene `version` 1 and 2. Rejects every other value, including ≥ 3,
 * with an error that names the version. Does not rewrite v1 into v2
 * (`toSceneV2` is Phase 1).
 */
export const SceneSchema = z
  .object({ version: z.unknown().optional() })
  .passthrough()
  .transform((doc, ctx): SceneJson => {
    if (doc.version !== 1 && doc.version !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["version"],
        message: `Unsupported scene version ${formatSceneVersion(doc.version)}; accepted versions are 1 and 2`,
      });
      return z.NEVER;
    }
    const parsed = (doc.version === 1 ? SceneSchemaV1 : SceneSchemaV2).safeParse(doc);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue(issue);
      return z.NEVER;
    }
    return parsed.data;
  });

function formatSceneVersion(version: unknown): string {
  if (typeof version === "string") return JSON.stringify(version);
  if (version === undefined) return "undefined";
  if (version === null) return "null";
  if (typeof version === "number" || typeof version === "boolean" || typeof version === "bigint") return String(version);
  try {
    return JSON.stringify(version);
  } catch {
    return String(version);
  }
}
