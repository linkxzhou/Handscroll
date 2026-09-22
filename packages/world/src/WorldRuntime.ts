import { pointAlong, sampleTrack, stepFollower, type FollowerState, type PathDef as AnimPath } from "@handscroll/animation";
import type {
  AabbItem,
  ActorDef,
  ActorSnapshot,
  FollowMode,
  SceneDocument,
  SpawnDef,
  ViewportState,
  WorldLoadOptions,
  WorldSystem,
  ZoneDef,
} from "@handscroll/core";
import { toSceneV2, type SceneV1, type SceneV2 } from "@handscroll/scene";
import { SpatialIndex } from "@handscroll/interaction";
import { DEFAULT_ACTIVE_MARGIN, viewportRect, type CullState, type WorldRect } from "./cull.ts";

interface SimActor {
  id: string;
  kind: ActorDef["kind"];
  x: number;
  y: number;
  zIndex: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  imageUrl?: string;
  atlasUrl?: string;
  frame?: string;
  frames?: string[];
  frameSeconds?: number;
  frameIndex: number;
  frameClock: number;
  path?: AnimPath;
  distance: number;
  speed: number;
  mode: FollowMode;
  direction: 1 | -1;
  finished: boolean;
  label?: string;
  interactionPriority?: number;
  cullEnabled: boolean;
  cull: CullState;
  scaleTrack?: { distance: number; value: number }[];
  scale: number;
  order: number;
}

export class WorldRuntime implements WorldSystem {
  private actors: SimActor[] = [];
  private zones: ZoneDef[] = [];
  private activeMargin = DEFAULT_ACTIVE_MARGIN;
  private readonly index = new SpatialIndex();

  load(scene: SceneDocument, options?: WorldLoadOptions): void {
    const doc = toSceneV2(scene as SceneV1 | SceneV2);
    this.activeMargin = options?.activeMargin ?? DEFAULT_ACTIVE_MARGIN;
    this.zones = doc.zones.map((zone) => ({ ...zone }));
    const paths = new Map(doc.paths.map((path) => [path.id, path]));
    const actors: SimActor[] = [];
    for (const actor of doc.actors) {
      actors.push(this.createActor(actor, actors.length, paths, options?.resolveUrl));
    }
    for (const spawn of doc.spawns) {
      for (const actor of expandSpawn(spawn, paths)) {
        actors.push(this.createActor(actor, actors.length, paths, options?.resolveUrl));
      }
    }
    this.actors = actors;
    this.reindex();
  }

  update(dt: number, viewport: ViewportState): void {
    const activeRect = viewportRect(viewport, this.activeMargin);
    const frozenRect = viewportRect(viewport, this.activeMargin * 2);
    this.reindex();
    const activeIds = new Set(this.index.queryRect(activeRect).map((item) => item.id));
    const frozenIds = new Set(this.index.queryRect(frozenRect).map((item) => item.id));

    for (const actor of this.actors) {
      actor.cull = classify(actor, activeIds, frozenIds);
      if (actor.cull !== "active") continue;
      if (actor.path) {
        const follower: FollowerState = {
          pathId: actor.path.id,
          distance: actor.distance,
          speed: actor.speed,
          mode: actor.mode,
          direction: actor.direction,
        };
        const sample = stepFollower(actor.path, follower, dt);
        actor.distance = follower.distance;
        actor.direction = follower.direction;
        actor.x = sample.x;
        actor.y = sample.y;
        actor.finished = sample.finished;
        if (actor.scaleTrack) actor.scale = sampleTrack(actor.scaleTrack, actor.distance);
      }
      this.advanceFrame(actor, dt);
    }
  }

  snapshots(): readonly ActorSnapshot[] {
    return this.actors.map((actor) => {
      const frame = actor.frames?.[actor.frameIndex] ?? actor.frame;
      const snapshot: ActorSnapshot = {
        id: actor.id,
        x: actor.x,
        y: actor.y,
        zIndex: actor.zIndex,
        visible: actor.cull !== "hidden",
        kind: actor.kind,
        width: actor.width,
        height: actor.height,
        anchorX: actor.anchorX,
        anchorY: actor.anchorY,
        scale: actor.scale,
      };
      if (actor.atlasUrl) snapshot.atlasUrl = actor.atlasUrl;
      if (frame) snapshot.frame = frame;
      if (actor.imageUrl) snapshot.imageUrl = actor.imageUrl;
      if (actor.label) snapshot.label = actor.label;
      if (actor.interactionPriority !== undefined) snapshot.interactionPriority = actor.interactionPriority;
      return snapshot;
    });
  }

  queryDynamic(): readonly AabbItem[] {
    const items: AabbItem[] = [];
    for (const actor of this.actors) {
      if (actor.cull === "hidden") continue;
      const box = actorRect(actor);
      items.push({
        id: actor.id,
        minX: box.minX,
        minY: box.minY,
        maxX: box.maxX,
        maxY: box.maxY,
        interactionPriority: actor.interactionPriority ?? actor.zIndex,
        order: actor.order,
        kind: "actor",
      });
    }
    return items;
  }

  getZones(): readonly ZoneDef[] {
    return this.zones;
  }

  getActorPosition(id: string): { x: number; y: number } | null {
    const actor = this.actors.find((item) => item.id === id);
    return actor ? { x: actor.x, y: actor.y } : null;
  }

  needsContinuous(): boolean {
    return this.actors.some(
      (actor) => actor.cull === "active" && actor.path !== undefined && actor.speed > 0 && !actor.finished,
    );
  }

  clear(): void {
    this.actors = [];
    this.zones = [];
    this.index.loadStatic([]);
    this.index.loadDynamic([]);
  }

  private createActor(
    def: ActorDef,
    order: number,
    paths: Map<string, AnimPath>,
    resolveUrl?: (relativePath: string) => string,
  ): SimActor {
    const path = def.pathId ? paths.get(def.pathId) : undefined;
    const mode = def.follow ?? "once";
    const direction: 1 | -1 = 1;
    const distance = def.distance ?? 0;
    const placed = path ? pointAlong(path.points, distance) : { x: def.x, y: def.y };
    const scale = def.scaleTrack ? sampleTrack(def.scaleTrack, distance) : 1;
    return {
      id: def.id,
      kind: def.kind,
      x: placed.x,
      y: placed.y,
      zIndex: def.zIndex ?? 0,
      width: def.width,
      height: def.height,
      anchorX: def.anchorX ?? 0.5,
      anchorY: def.anchorY ?? 1,
      imageUrl: resolveMaybe(def.imageUrl, resolveUrl),
      atlasUrl: resolveMaybe(def.atlas, resolveUrl),
      frame: def.frame,
      frames: def.frames,
      frameSeconds: def.frameSeconds,
      frameIndex: 0,
      frameClock: 0,
      path,
      distance,
      speed: def.speed ?? 0,
      mode,
      direction,
      finished: false,
      label: def.label?.text,
      interactionPriority: def.interactionPriority,
      cullEnabled: def.cull !== false,
      cull: "hidden",
      scaleTrack: def.scaleTrack,
      scale,
      order,
    };
  }

  private advanceFrame(actor: SimActor, dt: number): void {
    if (!actor.frames || actor.frames.length === 0 || !actor.frameSeconds || dt <= 0) return;
    actor.frameClock += dt;
    while (actor.frameClock >= actor.frameSeconds) {
      actor.frameClock -= actor.frameSeconds;
      actor.frameIndex = (actor.frameIndex + 1) % actor.frames.length;
    }
  }

  private reindex(): void {
    this.index.loadDynamic(
      this.actors.map((actor) => {
        const box = actorRect(actor);
        return { id: actor.id, minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY };
      }),
    );
  }
}

function classify(actor: SimActor, activeIds: Set<string>, frozenIds: Set<string>): CullState {
  if (!actor.cullEnabled) return "active";
  if (activeIds.has(actor.id)) return "active";
  if (frozenIds.has(actor.id)) return "frozen";
  return "hidden";
}

function actorRect(actor: SimActor): WorldRect {
  const minX = actor.x - actor.anchorX * actor.width;
  const minY = actor.y - actor.anchorY * actor.height;
  return { minX, minY, maxX: minX + actor.width, maxY: minY + actor.height };
}

function resolveMaybe(url: string | undefined, resolveUrl?: (relativePath: string) => string): string | undefined {
  if (!url) return undefined;
  if (!resolveUrl || /^(https?:|data:|\/)/.test(url)) return url;
  return resolveUrl(url);
}

function expandSpawn(spawn: SpawnDef, paths: Map<string, AnimPath>): ActorDef[] {
  const path = paths.get(spawn.pathId);
  if (!path) return [];
  const length = Math.max(1, pathLength(path));
  const random = mulberry32(spawn.seed);
  const actors: ActorDef[] = [];
  for (let i = 0; i < spawn.count; i += 1) {
    const speed = spawn.speedMin + (spawn.speedMax - spawn.speedMin) * random();
    actors.push({
      id: `${spawn.id}:${i}`,
      kind: "sprite",
      x: 0,
      y: 0,
      width: spawn.width,
      height: spawn.height,
      atlas: spawn.atlas,
      frames: spawn.frames,
      frame: spawn.frames[0],
      pathId: spawn.pathId,
      speed,
      follow: spawn.follow ?? "ping-pong",
      distance: (i / spawn.count) * length,
      cull: true,
    });
  }
  return actors;
}

function pathLength(path: AnimPath): number {
  let length = 0;
  for (let i = 1; i < path.points.length; i += 1) {
    const a = path.points[i - 1]!;
    const b = path.points[i]!;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
