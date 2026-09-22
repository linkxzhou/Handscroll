import { pointAlong, polylineLength, sampleTrack, stepFollower, type FollowerState, type PathDef as AnimPath } from "@handscroll/animation";
import type {
  AabbItem,
  ActorDef,
  ActorSnapshot,
  ArrivalNotice,
  FollowMode,
  LabelTrack,
  SceneDocument,
  SpawnDef,
  VesselSummonCommand,
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
  paused: boolean;
  /** Set by summon. Arrival fires once when distance reaches this value. */
  goal: number | null;
  arrivalQueued: boolean;
  label?: string;
  labelKeys?: string[];
  labelSeconds?: number;
  labelOffset?: number;
  interactionPriority?: number;
  cullEnabled: boolean;
  cull: CullState;
  scaleTrack?: { distance: number; value: number }[];
  scale: number;
  tint?: number;
  alpha: number;
  order: number;
}

interface LoadedScene {
  doc: SceneV2;
  resolveUrl?: (relativePath: string) => string;
}

/**
 * Spawns stay as scene data until `setSpawnsEnabled(true)` (the crowd plugin)
 * or `load(..., { expandSpawns: true })`.
 */
export class WorldRuntime implements WorldSystem {
  private actors: SimActor[] = [];
  private zones: ZoneDef[] = [];
  private activeMargin = DEFAULT_ACTIVE_MARGIN;
  private readonly index = new SpatialIndex();
  private loaded: LoadedScene | null = null;
  private paths = new Map<string, AnimPath>();
  private expandSpawns = false;
  private arrivals: ArrivalNotice[] = [];

  load(scene: SceneDocument, options?: WorldLoadOptions): void {
    const doc = toSceneV2(scene as SceneV1 | SceneV2);
    this.loaded = { doc, resolveUrl: options?.resolveUrl };
    this.activeMargin = options?.activeMargin ?? DEFAULT_ACTIVE_MARGIN;
    this.expandSpawns = options?.expandSpawns ?? false;
    this.rebuild();
  }

  setSpawnsEnabled(enabled: boolean): void {
    if (!this.loaded || this.expandSpawns === enabled) return;
    this.expandSpawns = enabled;
    this.rebuild();
  }

  summon(command: VesselSummonCommand): boolean {
    const actor = this.actors.find((item) => item.id === command.actorId);
    if (!actor) return false;
    if (command.pathId) {
      const path = this.paths.get(command.pathId);
      if (!path) return false;
      actor.path = path;
    }
    if (!actor.path) return false;
    const length = Math.max(0, pathLength(actor.path));
    const from = clamp(command.fromDistance ?? actor.distance, 0, length);
    const to = clamp(command.toDistance ?? length, 0, length);
    actor.distance = from;
    actor.goal = to;
    if (command.speed !== undefined) actor.speed = Math.max(0, command.speed);
    actor.mode = "once";
    actor.paused = false;
    actor.direction = to >= from ? 1 : -1;
    actor.arrivalQueued = false;
    this.place(actor, from);
    const travel = Math.abs(to - from);
    if (command.quiet || travel <= 1e-3 || actor.speed <= 0) {
      actor.finished = true;
      actor.arrivalQueued = true;
      return true;
    }
    actor.finished = false;
    return true;
  }

  pauseActor(actorId: string): void {
    const actor = this.actors.find((item) => item.id === actorId);
    if (actor) actor.paused = true;
  }

  resumeActor(actorId: string): void {
    const actor = this.actors.find((item) => item.id === actorId);
    if (!actor) return;
    actor.paused = false;
    if (actor.goal != null && Math.abs(actor.goal - actor.distance) > 1e-3) {
      actor.finished = false;
      actor.arrivalQueued = false;
    }
  }

  setActorAlpha(actorId: string, alpha: number): void {
    const actor = this.actors.find((item) => item.id === actorId);
    if (!actor) return;
    actor.alpha = clamp(alpha, 0, 1);
  }

  setLabel(actorId: string, text: string): void {
    const actor = this.actors.find((item) => item.id === actorId);
    if (actor) actor.label = text;
  }

  labelTracks(): readonly LabelTrack[] {
    const tracks: LabelTrack[] = [];
    for (const actor of this.actors) {
      if (!actor.labelKeys || actor.labelKeys.length === 0) continue;
      tracks.push({
        id: actor.id,
        keys: actor.labelKeys,
        seconds: actor.labelSeconds ?? 0,
        offset: actor.labelOffset ?? 0,
        active: actor.cull === "active",
      });
    }
    return tracks;
  }

  drainArrivals(): ArrivalNotice[] {
    const notices = this.arrivals;
    this.arrivals = [];
    return notices;
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
      if (actor.path && actor.goal != null) this.stepGoal(actor, dt);
      else if (actor.path) {
        const follower: FollowerState = {
          pathId: actor.path.id,
          distance: actor.distance,
          speed: actor.speed,
          mode: actor.mode,
          direction: actor.direction,
          paused: actor.paused,
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
        alpha: actor.alpha,
        flipX: actor.direction === -1 && actor.path !== undefined,
      };
      if (actor.atlasUrl) snapshot.atlasUrl = actor.atlasUrl;
      if (frame) snapshot.frame = frame;
      if (actor.imageUrl) snapshot.imageUrl = actor.imageUrl;
      if (actor.label) snapshot.label = actor.label;
      if (actor.interactionPriority !== undefined) snapshot.interactionPriority = actor.interactionPriority;
      if (actor.tint !== undefined) snapshot.tint = actor.tint;
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
      (actor) => actor.cull === "active" && actor.path !== undefined && actor.speed > 0 && !actor.finished && !actor.paused,
    );
  }

  clear(): void {
    this.actors = [];
    this.zones = [];
    this.paths = new Map();
    this.loaded = null;
    this.expandSpawns = false;
    this.arrivals = [];
    this.index.loadStatic([]);
    this.index.loadDynamic([]);
  }

  private rebuild(): void {
    const loaded = this.loaded;
    if (!loaded) return;
    this.arrivals = [];
    this.zones = loaded.doc.zones.map((zone) => ({ ...zone }));
    this.paths = new Map(loaded.doc.paths.map((path) => [path.id, path]));
    const actors: SimActor[] = [];
    for (const actor of loaded.doc.actors) {
      actors.push(this.createActor(actor, actors.length, this.paths, loaded.resolveUrl));
    }
    if (this.expandSpawns) {
      for (const spawn of loaded.doc.spawns) {
        for (const actor of expandSpawn(spawn, this.paths)) {
          actors.push(this.createActor(actor, actors.length, this.paths, loaded.resolveUrl));
        }
      }
    }
    this.actors = actors;
    this.reindex();
  }

  private stepGoal(actor: SimActor, dt: number): void {
    if (!actor.path || actor.goal == null || actor.finished || actor.paused || dt <= 0 || actor.speed <= 0) return;
    const dir: 1 | -1 = actor.goal >= actor.distance ? 1 : -1;
    actor.direction = dir;
    const remaining = Math.abs(actor.goal - actor.distance);
    const travel = Math.min(remaining, actor.speed * dt);
    actor.distance += dir * travel;
    if (remaining - travel <= 1e-3) {
      actor.distance = actor.goal;
      actor.finished = true;
      this.queueArrival(actor);
    }
    this.place(actor, actor.distance);
  }

  private queueArrival(actor: SimActor): void {
    if (actor.arrivalQueued || !actor.path) return;
    actor.arrivalQueued = true;
    this.arrivals.push({ actorId: actor.id, pathId: actor.path.id });
  }

  private place(actor: SimActor, distance: number): void {
    if (!actor.path) return;
    const pos = pointAlong(actor.path.points, distance);
    actor.x = pos.x;
    actor.y = pos.y;
    if (actor.scaleTrack) actor.scale = sampleTrack(actor.scaleTrack, distance);
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
    const length = path ? pathLength(path) : 0;
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
      finished: mode === "once" && length > 0 && distance >= length - 1e-3,
      paused: false,
      goal: null,
      arrivalQueued: false,
      label: def.label?.text,
      labelKeys: def.label?.cycleKeys,
      labelSeconds: def.label?.cycleSeconds,
      labelOffset: def.label?.cycleOffset,
      interactionPriority: def.interactionPriority,
      cullEnabled: def.cull !== false,
      cull: "hidden",
      scaleTrack: def.scaleTrack,
      scale,
      tint: def.tint,
      alpha: def.alpha ?? 1,
      order,
    };
  }

  private advanceFrame(actor: SimActor, dt: number): void {
    if (!actor.frames || actor.frames.length === 0 || !actor.frameSeconds || dt <= 0 || actor.paused) return;
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
  const width = actor.width * actor.scale;
  const height = actor.height * actor.scale;
  const minX = actor.x - actor.anchorX * width;
  const minY = actor.y - actor.anchorY * height;
  return { minX, minY, maxX: minX + width, maxY: minY + height };
}

function resolveMaybe(url: string | undefined, resolveUrl?: (relativePath: string) => string): string | undefined {
  if (!url) return undefined;
  if (!resolveUrl || /^(https?:|data:|\/)/.test(url)) return url;
  return resolveUrl(url);
}

export function expandSpawn(spawn: SpawnDef, paths: Map<string, AnimPath>): ActorDef[] {
  const path = paths.get(spawn.pathId);
  if (!path) return [];
  const length = Math.max(1, pathLength(path));
  const random = mulberry32(spawn.seed);
  const actors: ActorDef[] = [];
  for (let i = 0; i < spawn.count; i += 1) {
    const speed = spawn.speedMin + (spawn.speedMax - spawn.speedMin) * random();
    const distance = ((i + random()) / spawn.count) * length;
    actors.push({
      id: `${spawn.id}:${i}`,
      kind: "sprite",
      x: 0,
      y: 0,
      zIndex: spawn.zIndex,
      width: spawn.width,
      height: spawn.height,
      anchorX: spawn.anchorX,
      anchorY: spawn.anchorY,
      atlas: spawn.atlas,
      frames: spawn.frames,
      frame: spawn.frames[0],
      frameSeconds: spawn.frameSeconds,
      pathId: spawn.pathId,
      speed,
      follow: spawn.follow ?? "ping-pong",
      distance,
      tint: spawn.tint,
      cull: true,
    });
  }
  return actors;
}

function pathLength(path: AnimPath): number {
  return polylineLength(path.points);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic unit random in [0, 1). Same seed reproduces distances and speeds. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
