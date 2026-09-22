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
  world: z
    .object({
      activeMargin: z.number().positive().optional(),
    })
    .optional(),
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

const PathSchema = z.object({
  id: z.string(),
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(2),
  closed: z.boolean().optional(),
});

const ActorSchema = z.object({
  id: z.string(),
  kind: z.enum(["sprite", "marker", "label", "occluder"]),
  x: z.number(),
  y: z.number(),
  zIndex: z.number().default(0),
  width: z.number().positive(),
  height: z.number().positive(),
  anchorX: z.number().min(0).max(1).default(0.5),
  anchorY: z.number().min(0).max(1).default(1),
  imageUrl: z.string().optional(),
  atlas: z.string().optional(),
  frame: z.string().optional(),
  frames: z.array(z.string()).optional(),
  frameSeconds: z.number().positive().optional(),
  pathId: z.string().optional(),
  speed: z.number().nonnegative().optional(),
  follow: z.enum(["once", "loop", "ping-pong"]).optional(),
  distance: z.number().nonnegative().optional(),
  label: z
    .object({
      i18nKey: z.string().optional(),
      text: z.string().optional(),
      cycleKeys: z.array(z.string()).optional(),
      cycleSeconds: z.number().positive().optional(),
      cycleOffset: z.number().nonnegative().optional(),
    })
    .optional(),
  interactionPriority: z.number().optional(),
  cull: z.boolean().default(true),
  scaleTrack: z.array(z.object({ distance: z.number(), value: z.number() })).optional(),
  tint: z.number().int().nonnegative().max(0xffffff).optional(),
  alpha: z.number().min(0).max(1).optional(),
});

const ZoneSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  shape: z.union([RectShape, CircleShape, PolygonShape]),
  chapterId: z.string().optional(),
});

const SpawnSchema = z.object({
  id: z.string(),
  pathId: z.string(),
  count: z.number().int().positive().max(64),
  speedMin: z.number().positive(),
  speedMax: z.number().positive(),
  atlas: z.string(),
  frames: z.array(z.string()).min(1),
  follow: z.enum(["loop", "ping-pong"]).default("ping-pong"),
  seed: z.number().int(),
  width: z.number().positive(),
  height: z.number().positive(),
  tint: z.number().int().nonnegative().max(0xffffff).optional(),
  zIndex: z.number().optional(),
  frameSeconds: z.number().positive().optional(),
  anchorX: z.number().min(0).max(1).optional(),
  anchorY: z.number().min(0).max(1).optional(),
});

const DialogueStubSchema = z.object({
  id: z.string(),
  lineKeys: z.array(z.string()).min(1),
});

const TriggerWhenSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("zone:enter"),
    zoneId: z.string(),
    subject: z.enum(["camera", "actor"]),
    actorId: z.string().optional(),
  }),
  z.object({
    type: z.literal("zone:exit"),
    zoneId: z.string(),
    subject: z.enum(["camera", "actor"]),
    actorId: z.string().optional(),
  }),
  z.object({ type: z.literal("entity:click"), entityId: z.string() }),
  z.object({ type: z.literal("chapter:enter"), chapterId: z.string() }),
  z.object({ type: z.literal("custom"), event: z.string() }),
]);

const TriggerSchema = z.object({
  id: z.string(),
  when: TriggerWhenSchema,
  emit: z.string(),
  once: z.boolean().optional(),
  payload: z.unknown().optional(),
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

/** Published v1 shape. World arrays are not part of this document and are stripped. */
export const SceneSchemaV1 = z.object({
  version: z.literal(1),
  ...sceneCommon,
});

/**
 * Version 2 is a superset of v1 (ADR 0004).
 * Missing world arrays default to `[]`.
 */
export const SceneSchemaV2 = SceneSchemaV1.extend({
  version: z.literal(2),
  paths: z.array(PathSchema).default([]),
  actors: z.array(ActorSchema).default([]),
  zones: z.array(ZoneSchema).default([]),
  spawns: z.array(SpawnSchema).default([]),
  dialogues: z.array(DialogueStubSchema).default([]),
  triggers: z.array(TriggerSchema).default([]),
});

export type SceneV1 = z.infer<typeof SceneSchemaV1>;
export type SceneV2 = z.infer<typeof SceneSchemaV2>;
export type SceneJson = SceneV1 | SceneV2;

/**
 * Runtime helper. Version 1 becomes version 2 with empty world arrays.
 * It does not invent actors from story code.
 */
export function toSceneV2(doc: SceneV1 | SceneV2): SceneV2 {
  if (doc.version === 2) {
    return {
      ...doc,
      version: 2,
      paths: doc.paths ?? [],
      actors: doc.actors ?? [],
      zones: doc.zones ?? [],
      spawns: doc.spawns ?? [],
      dialogues: doc.dialogues ?? [],
      triggers: doc.triggers ?? [],
    };
  }
  return {
    ...doc,
    version: 2,
    paths: [],
    actors: [],
    zones: [],
    spawns: [],
    dialogues: [],
    triggers: [],
  };
}

/**
 * Accepts scene `version` 1 and 2. Rejects every other value, including ≥ 3,
 * with an error that names the version. Parsing does not rewrite v1 into v2;
 * call `toSceneV2` for the single runtime path.
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
