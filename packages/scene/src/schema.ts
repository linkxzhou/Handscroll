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

export const SceneSchema = z.object({
  version: z.literal(1),
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
});

export type SceneJson = z.infer<typeof SceneSchema>;
