import { describe, expect, it } from "vitest";
import { MetaSchema, SceneSchema, toSceneV2 } from "./schema.ts";

describe("schemas B-U-01/02", () => {
  it("rejects meta without license.assets (B-U-01)", () => {
    const result = MetaSchema.safeParse({
      id: "demo-scroll",
      title: "Demo",
      width: 10,
      height: 10,
      license: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown entity types (B-U-02)", () => {
    const result = SceneSchema.safeParse({
      version: 1,
      meta: { id: "demo-scroll", width: 10, height: 10 },
      background: { manifestUrl: "./tiles/manifest.json" },
      entities: [{ id: "x", type: "ferry", x: 0, y: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts version 1 and strips world arrays that belong to version 2", () => {
    const result = SceneSchema.safeParse({
      ...baseScene(1),
      paths: [{ id: "not-v1" }],
      extra: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.version).toBe(1);
    expect("paths" in result.data).toBe(false);
    expect("extra" in result.data).toBe(false);
  });

  it("accepts version 2 and defaults missing world arrays to empty", () => {
    const result = SceneSchema.safeParse({ ...baseScene(2), note: "stripped" });
    expect(result.success).toBe(true);
    if (!result.success || result.data.version !== 2) return;
    expect(result.data.paths).toEqual([]);
    expect(result.data.actors).toEqual([]);
    expect(result.data.zones).toEqual([]);
    expect(result.data.spawns).toEqual([]);
    expect(result.data.dialogues).toEqual([]);
    expect(result.data.triggers).toEqual([]);
    expect("note" in result.data).toBe(false);
    expect(result.data.entities).toEqual(baseScene(2).entities);
  });

  it("keeps a valid version 2 path and applies actor defaults", () => {
    const paths = [{ id: "road", points: [{ x: 1, y: 2 }, { x: 4, y: 2 }] }];
    const result = SceneSchema.safeParse({
      ...baseScene(2),
      paths,
      actors: [{ id: "walker", kind: "sprite", x: 1, y: 2, width: 8, height: 12 }],
    });
    expect(result.success).toBe(true);
    if (!result.success || result.data.version !== 2) return;
    expect(result.data.paths).toEqual(paths);
    expect(result.data.actors[0]).toMatchObject({
      id: "walker",
      anchorX: 0.5,
      anchorY: 1,
      cull: true,
      zIndex: 0,
    });
  });

  it("rejects a path with fewer than two points and a spawn over the count cap", () => {
    expect(
      SceneSchema.safeParse({ ...baseScene(2), paths: [{ id: "road", points: [{ x: 1, y: 2 }] }] }).success,
    ).toBe(false);
    expect(
      SceneSchema.safeParse({
        ...baseScene(2),
        spawns: [
          {
            id: "crowd",
            pathId: "road",
            count: 65,
            speedMin: 1,
            speedMax: 2,
            atlas: "./atlas/a.webp",
            frames: ["a"],
            seed: 1,
            width: 8,
            height: 8,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("toSceneV2 keeps v1 hotspots and adds empty world arrays (W-U-03)", () => {
    const parsed = SceneSchema.parse(baseScene(1));
    const v2 = toSceneV2(parsed);
    expect(v2.version).toBe(2);
    expect(v2.entities).toEqual(baseScene(1).entities);
    expect(v2.paths).toEqual([]);
    expect(v2.actors).toEqual([]);
    expect(v2.zones).toEqual([]);
    expect(v2.spawns).toEqual([]);
    expect(v2.dialogues).toEqual([]);
    expect(v2.triggers).toEqual([]);
    const again = toSceneV2(v2);
    expect(again.entities[0]?.id).toBe("mark");
    expect(again.actors).toEqual([]);
  });

  it("rejects version 2 when a world array is not an array", () => {
    const result = SceneSchema.safeParse({ ...baseScene(2), actors: { id: "nope" } });
    expect(result.success).toBe(false);
  });

  it("rejects unknown entity types on version 2", () => {
    const result = SceneSchema.safeParse({
      ...baseScene(2),
      entities: [{ id: "x", type: "ferry", x: 0, y: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it.each([3, 4, 0, 2.5, "2", null, undefined])("rejects unsupported scene version %s", (version) => {
    const result = SceneSchema.safeParse({ ...baseScene(1), version });
    expect(result.success).toBe(false);
    if (result.success) return;
    const versionIssue = result.error.issues.find((issue) => issue.path.join(".") === "version");
    expect(versionIssue?.message).toBe(
      `Unsupported scene version ${formatExpected(version)}; accepted versions are 1 and 2`,
    );
  });
});

function baseScene(version: 1 | 2) {
  return {
    version,
    meta: { id: "demo-scroll", width: 10, height: 10 },
    background: { manifestUrl: "./tiles/manifest.json" },
    entities: [{ id: "mark", type: "hotspot" as const, x: 1, y: 2, shape: { kind: "circle" as const, r: 4 } }],
    chapters: [],
  };
}

function formatExpected(version: unknown): string {
  if (typeof version === "string") return JSON.stringify(version);
  if (version === undefined) return "undefined";
  if (version === null) return "null";
  return String(version);
}
