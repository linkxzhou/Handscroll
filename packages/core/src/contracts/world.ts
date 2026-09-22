import type { AabbItem } from "./spatial.ts";
import type { TriggerDef } from "./trigger.ts";
import type { ViewportState } from "./viewport.ts";

export type ActorKind = "sprite" | "marker" | "label" | "occluder";
export type FollowMode = "once" | "loop" | "ping-pong";

export interface PathDef {
  id: string;
  points: { x: number; y: number }[];
  closed?: boolean;
}

export interface ActorLabelDef {
  i18nKey?: string;
  text?: string;
  cycleKeys?: string[];
  cycleSeconds?: number;
  /** Seconds added before the first cycle, so neighboring signs do not flip together. */
  cycleOffset?: number;
}

export interface ActorDef {
  id: string;
  kind: ActorKind;
  x: number;
  y: number;
  zIndex?: number;
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
  imageUrl?: string;
  atlas?: string;
  frame?: string;
  frames?: string[];
  frameSeconds?: number;
  pathId?: string;
  speed?: number;
  follow?: FollowMode;
  distance?: number;
  label?: ActorLabelDef;
  interactionPriority?: number;
  cull?: boolean;
  scaleTrack?: { distance: number; value: number }[];
  /** 0xRRGGBB. Omitted leaves the texture untinted. */
  tint?: number;
  /** 0–1. Omitted means fully opaque. */
  alpha?: number;
}

export type ZoneShape =
  | { kind: "rect"; w: number; h: number }
  | { kind: "circle"; r: number }
  | { kind: "polygon"; points: { x: number; y: number }[] };

export interface ZoneDef {
  id: string;
  x: number;
  y: number;
  shape: ZoneShape;
  chapterId?: string;
}

export interface SpawnDef {
  id: string;
  pathId: string;
  count: number;
  speedMin: number;
  speedMax: number;
  atlas: string;
  frames: string[];
  follow?: "loop" | "ping-pong";
  seed: number;
  width: number;
  height: number;
  tint?: number;
  zIndex?: number;
  frameSeconds?: number;
  anchorX?: number;
  anchorY?: number;
}

/** Story or a trigger asks a vessel actor to travel a path segment. */
export interface VesselSummonCommand {
  actorId: string;
  pathId?: string;
  fromDistance?: number;
  toDistance?: number;
  speed?: number;
  /** Place the actor and do not emit an arrival. */
  quiet?: boolean;
}

export interface LabelTrack {
  id: string;
  keys: string[];
  seconds: number;
  offset: number;
  /** True when the label actor is inside the active cull rect. */
  active: boolean;
}

export interface ArrivalNotice {
  actorId: string;
  pathId: string;
}

export interface DialogueStub {
  id: string;
  lineKeys: string[];
}

/** Scene fields the world simulator reads. Version 1 documents omit the arrays. */
export interface WorldScene {
  version: 1 | 2;
  paths?: PathDef[];
  actors?: ActorDef[];
  zones?: ZoneDef[];
  spawns?: SpawnDef[];
  dialogues?: DialogueStub[];
  triggers?: TriggerDef[];
}

export interface ActorSnapshot {
  id: string;
  x: number;
  y: number;
  zIndex: number;
  /** False when the actor is outside the cull rect. */
  visible: boolean;
  kind: ActorKind;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  atlasUrl?: string;
  frame?: string;
  imageUrl?: string;
  tint?: number;
  alpha?: number;
  flipX?: boolean;
  /** Resolved copy. The renderer draws this; it is not an i18n key. */
  label?: string;
  interactionPriority?: number;
  /** Extra uniform scale from a scalar track. 1 when unset. */
  scale?: number;
}

export interface WorldLoadOptions {
  activeMargin?: number;
  resolveUrl?: (relativePath: string) => string;
  /**
   * When true, `spawns` become actors during load.
   * Default false: the crowd plugin turns them on so a pack without crowd
   * keeps the spawn rows as data only.
   */
  expandSpawns?: boolean;
}

export interface WorldSystem {
  load(scene: WorldScene, options?: WorldLoadOptions): void;
  update(dt: number, viewport: ViewportState): void;
  snapshots(): readonly ActorSnapshot[];
  queryDynamic(): readonly AabbItem[];
  getZones(): readonly ZoneDef[];
  getActorPosition(id: string): { x: number; y: number } | null;
  needsContinuous(): boolean;
  clear(): void;
  /** Instantiate scene spawns, or drop those instances. Other actors reload from the scene. */
  setSpawnsEnabled(enabled: boolean): void;
  summon(command: VesselSummonCommand): boolean;
  pauseActor(actorId: string): void;
  resumeActor(actorId: string): void;
  setActorAlpha(actorId: string, alpha: number): void;
  setLabel(actorId: string, text: string): void;
  labelTracks(): readonly LabelTrack[];
  /** Arrival notices since the previous drain. Each completed summon is queued once. */
  drainArrivals(): ArrivalNotice[];
}
