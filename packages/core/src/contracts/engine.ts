import type { SceneMeta, ViewportState, FlyToOptions } from "./viewport.ts";
import type { PluginFactory } from "./plugin.ts";
import type { HitResult } from "./hit.ts";
import type { AabbItem } from "./spatial.ts";
import type { ActorSnapshot, DialogueStub, PathDef, SpawnDef, WorldSystem, ZoneDef, ActorDef } from "./world.ts";
import type { TriggerDef } from "./trigger.ts";

export type QualityLevel = "auto" | "low" | "medium" | "high";
export type SchedulerMode = "continuous" | "on-demand";

export interface EngineConfig {
  container: HTMLElement;
  renderers: { pixi: true; three: false | "lazy" };
  quality?: QualityLevel;
  dprMax?: number;
}

export interface CachePolicy {
  gpuBudgetBytes: number;
  decodedBudgetBytes: number;
  maxConcurrentRequests: number;
  maxUploadsPerFrame: number;
}

export const DEFAULT_CACHE_POLICY: CachePolicy = {
  gpuBudgetBytes: 256 * 1024 * 1024,
  decodedBudgetBytes: 192 * 1024 * 1024,
  maxConcurrentRequests: 6,
  maxUploadsPerFrame: 4,
};

export interface ContentResolver {
  loadMeta(scrollId: string): Promise<ContentMeta>;
  loadManifest(scrollId: string): Promise<unknown>;
  loadScene(scrollId: string): Promise<SceneDocument>;
  resolveUrl(scrollId: string, relativePath: string): string;
  loadStory?(scrollId: string, entry: string): Promise<StoryModule | null>;
}

export interface ContentMeta extends SceneMeta {
  title: string;
  plugins: string[];
  pluginConfig?: Record<string, unknown>;
  defaultViewport?: Pick<ViewportState, "centerX" | "centerY" | "zoom">;
  storyEntry?: string;
  /** Optional world-sim overrides. Absent means engine defaults. */
  world?: { activeMargin?: number };
}

export interface ChapterBookmark {
  id: string;
  titleKey?: string;
  title?: string;
  centerX: number;
  centerY: number;
  zoom: number;
}

export type SceneEntity =
  | SpriteEntity
  | AnimationEntity
  | HotspotEntity
  | Model3dEntity;

export interface SceneEntityBase {
  id: string;
  x: number;
  y: number;
  zIndex?: number;
  ownerPluginId?: string;
}

export interface SpriteEntity extends SceneEntityBase {
  type: "sprite";
  url: string;
  width?: number;
  height?: number;
}

export interface AnimationEntity extends SceneEntityBase {
  type: "animation";
  atlas?: string;
}

export type HotspotShape =
  | { kind: "rect"; w: number; h: number }
  | { kind: "circle"; r: number }
  | { kind: "polygon"; points: { x: number; y: number }[] };

export interface HotspotEntity extends SceneEntityBase {
  type: "hotspot";
  shape: HotspotShape;
  interactionPriority?: number;
  action?: { type: "openPanel" | "emit" | "flyTo" | "none"; payload?: unknown };
  i18nKey?: string;
}

export interface Model3dEntity extends SceneEntityBase {
  type: "model3d";
  url: string;
}

export interface SceneDocument {
  /**
   * `1` is the published v1 shape (world arrays stripped).
   * `2` is that shape plus paths, actors, zones, spawns, dialogues, and triggers.
   */
  version: 1 | 2;
  meta: SceneMeta;
  background: { manifestUrl: string };
  entities: SceneEntity[];
  chapters: ChapterBookmark[];
  paths?: PathDef[];
  actors?: ActorDef[];
  zones?: ZoneDef[];
  spawns?: SpawnDef[];
  dialogues?: DialogueStub[];
  triggers?: TriggerDef[];
}

export interface StoryModule {
  registerStory?(engine: unknown): void | (() => void) | Promise<void | (() => void)>;
}

export interface VisibleTile {
  key: string;
  levelId: string;
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  url: string;
  ready: boolean;
  bitmap?: ImageBitmap;
  priority: number;
}

/** Opaque Three overlay objects (typically `THREE.Object3D`). Core does not import three. */
export interface ThreeOverlayHost {
  attach(object: unknown): void;
  detach(object: unknown): void;
}

export interface RendererAdapter {
  readonly kind: "pixi" | "three";
  mount(container: HTMLElement): Promise<HTMLCanvasElement>;
  setSize(width: number, height: number, dpr: number): void;
  sync(viewport: ViewportState): void;
  setTiles?(tiles: readonly VisibleTile[]): void;
  /** World actors in world coordinates. Omitted by adapters that predate Phase 1. */
  setActors?(actors: readonly ActorSnapshot[]): void;
  needsThree?(): boolean;
  ensureLoaded?(): Promise<void>;
  attachOverlay?(object: unknown): void;
  detachOverlay?(object: unknown): void;
  render(): void;
  destroy(): void;
}

export interface RendererFactories {
  createPixi: () => RendererAdapter;
  createThree?: () => RendererAdapter;
}

export interface EngineCreateOptions extends EngineConfig {
  contentResolver: ContentResolver;
  adapters: RendererFactories;
  pluginRegistry: Record<string, PluginFactory>;
  cachePolicy?: Partial<CachePolicy>;
}

export interface EventBusLike {
  on(event: string, handler: (...args: unknown[]) => void): () => void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, payload?: unknown): void;
}

export interface ViewportControllerLike {
  getState(): ViewportState;
  flyTo(opts: FlyToOptions): void;
  interruptTransition(): void;
  /** True during flyTo or leftover pan inertia. Optional so older test doubles still typecheck. */
  isAnimating?(): boolean;
}

export interface SchedulerLike {
  requestFrame(): void;
  wake(): void;
  requestContinuous(reason: string): void;
  releaseContinuous(reason: string): void;
}

export interface ScrollEnginePublic {
  readonly events: EventBusLike;
  readonly camera: ViewportControllerLike;
  readonly scheduler: SchedulerLike;
  getViewport(): ViewportState;
  setQuality(q: QualityLevel): void;
  getQuality(): QualityLevel;
  getCachePolicy(): CachePolicy;
  setCachePolicy(partial: Partial<CachePolicy>): void;
  getContainer(): HTMLElement;
  getUiLayer(): HTMLElement;
  getDpr(): number;
  getScrollId(): string | null;
  /**
   * Lazy-load the Three overlay if this viewer mounted one.
   * Resolves `null` when `renderers.three` is false or the adapter is missing.
   */
  ensureThree(): Promise<ThreeOverlayHost | null>;
}

export interface TileSystem {
  load(manifest: unknown, baseUrl: string): Promise<void>;
  update(viewport: ViewportState, policy: CachePolicy, dpr: number): void;
  getVisibleTiles(): readonly VisibleTile[];
  hasPending(): boolean;
  clear(): void;
}

export interface AssetSystem {
  cancelAll(): void;
  cancel?(url: string): void;
}

export interface InteractionSystem {
  setEntities(entities: readonly SceneEntity[]): void;
  /** Replace this frame's moving AABBs. Static hotspots stay loaded. */
  sync(items: readonly AabbItem[]): void;
  pickAll(worldX: number, worldY: number): HitResult[];
}

export interface AnimationSystem {
  update(dt: number): void;
  clear(): void;
}

export interface EngineServices {
  assets: AssetSystem;
  tiles: TileSystem;
  interaction: InteractionSystem;
  animation: AnimationSystem;
  world: WorldSystem;
}
