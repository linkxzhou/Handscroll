import type { SceneMeta, ViewportState, FlyToOptions } from "./viewport.ts";
import type { PluginFactory, PluginHostLike } from "./plugin.ts";
import type { HitResult } from "./hit.ts";

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
  version: 1;
  meta: SceneMeta;
  background: { manifestUrl: string };
  entities: SceneEntity[];
  chapters: ChapterBookmark[];
}

export type StoryCleanup = () => void;

export interface StoryModule {
  registerStory?(
    engine: ScrollEnginePublic,
  ): void | StoryCleanup | Promise<void | StoryCleanup>;
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

export interface RendererAdapter {
  readonly kind: "pixi" | "three";
  mount(container: HTMLElement): Promise<HTMLCanvasElement>;
  setSize(width: number, height: number, dpr: number): void;
  sync(viewport: ViewportState): void;
  setTiles?(tiles: readonly VisibleTile[]): void;
  setSceneEntities?(entities: readonly SceneEntity[]): void;
  needsThree?(): boolean;
  ensureLoaded?(): Promise<void>;
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
  readonly plugins: PluginHostLike;
  on(event: string, handler: (...args: unknown[]) => void): () => void;
  getViewport(): ViewportState;
  setQuality(q: QualityLevel): void;
  getQuality(): QualityLevel;
  getCachePolicy(): CachePolicy;
  setCachePolicy(partial: Partial<CachePolicy>): void;
  getContainer(): HTMLElement;
  getUiLayer(): HTMLElement;
  getDpr(): number;
  getScrollId(): string | null;
  getScene(): SceneDocument | null;
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
}
