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
}
