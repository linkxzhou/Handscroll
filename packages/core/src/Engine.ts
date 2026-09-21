import type {
  CachePolicy,
  ContentMeta,
  EngineCreateOptions,
  EngineServices,
  QualityLevel,
  RendererAdapter,
  SceneDocument,
  ScrollEnginePublic,
  ThreeOverlayHost,
  VisibleTile,
} from "./contracts/engine.ts";
import { DEFAULT_CACHE_POLICY } from "./contracts/engine.ts";
import type { ViewportState } from "./contracts/viewport.ts";
import { EventBus } from "./EventBus.ts";
import { PluginHost } from "./PluginHost.ts";
import { ViewportController } from "./viewport/ViewportController.ts";
import { InputManager } from "./input/InputManager.ts";
import { RenderScheduler } from "./scheduler/RenderScheduler.ts";
import type { HitResult } from "./contracts/hit.ts";

export type { EngineServices } from "./contracts/engine.ts";

export class ScrollEngine implements ScrollEnginePublic {
  readonly events = new EventBus();
  readonly camera: ViewportController;
  readonly scheduler: RenderScheduler;
  readonly plugins: PluginHost;

  private readonly options: EngineCreateOptions;
  private readonly services: EngineServices;
  private pixi: RendererAdapter | null = null;
  private three: RendererAdapter | null = null;
  private input: InputManager | null = null;
  private uiLayer: HTMLElement;
  private cachePolicy: CachePolicy;
  private quality: QualityLevel;
  private dpr: number;
  private scrollId: string | null = null;
  private meta: ContentMeta | null = null;
  private scene: SceneDocument | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private storyCleanup: (() => void) | null = null;

  private constructor(options: EngineCreateOptions, services: EngineServices) {
    this.options = options;
    this.services = services;
    this.camera = new ViewportController({
      centerX: 0,
      centerY: 0,
      zoom: 1,
      screenWidth: options.container.clientWidth || 1,
      screenHeight: options.container.clientHeight || 1,
    });
    this.scheduler = new RenderScheduler();
    this.plugins = new PluginHost(options.pluginRegistry, "warn");
    this.quality = options.quality ?? "auto";
    this.cachePolicy = { ...DEFAULT_CACHE_POLICY, ...options.cachePolicy };
    this.dpr = 1;
    this.uiLayer = document.createElement("div");
    this.uiLayer.className = "ui-layer";
    this.plugins.setContext({
      engine: this,
      scene: null,
      quality: this.quality,
    });
  }

  static async create(options: EngineCreateOptions, services: EngineServices): Promise<ScrollEngine> {
    const engine = new ScrollEngine(options, services);
    await engine.mount();
    return engine;
  }

  async loadContent(scrollId: string): Promise<void> {
    this.assertAlive();
    await this.unloadCurrent();

    const meta = await this.options.contentResolver.loadMeta(scrollId);
    this.scrollId = scrollId;
    this.meta = meta;

    await this.plugins.loadBuiltins(meta.plugins ?? [], meta.pluginConfig);
    this.plugins.setContext({ engine: this, scene: null, quality: this.quality });

    const manifest = await this.options.contentResolver.loadManifest(scrollId);
    const tilesBase = this.options.contentResolver.resolveUrl(scrollId, "tiles/");
    await this.services.tiles.load(manifest, tilesBase);

    const scene = await this.options.contentResolver.loadScene(scrollId);
    this.scene = scene;
    this.services.interaction.setEntities(scene.entities);

    this.camera.setScene(scene.meta);
    if (meta.defaultViewport) {
      this.camera.setCenter(
        meta.defaultViewport.centerX,
        meta.defaultViewport.centerY,
        meta.defaultViewport.zoom,
      );
    } else {
      this.camera.setCenter(scene.meta.width / 2, scene.meta.height / 2, this.camera.getState().zoom);
    }

    const needsThree = scene.entities.some((e) => e.type === "model3d");
    if (needsThree && this.three?.ensureLoaded) {
      await this.three.ensureLoaded();
    }

    const storyEntry = meta.storyEntry ?? "./story/index.ts";
    if (this.options.contentResolver.loadStory) {
      const story = await this.options.contentResolver.loadStory(scrollId, storyEntry);
      if (story?.registerStory) {
        const registered = await story.registerStory(this);
        if (typeof registered === "function") this.storyCleanup = registered;
      }
    }

    await this.plugins.broadcastSceneLoad(scene);
    this.events.emit("content:load", { scrollId });
    this.scheduler.requestFrame();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.unloadCurrent();
    this.scheduler.stop();
    this.input?.detach();
    this.input = null;
    await this.plugins.destroyAll();
    this.pixi?.destroy();
    this.three?.destroy();
    this.pixi = null;
    this.three = null;
    this.services.assets.cancelAll();
    this.services.tiles.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.options.container.replaceChildren();
    this.events.clear();
  }

  on(event: string, handler: (...args: unknown[]) => void): () => void {
    return this.events.on(event, handler);
  }

  getViewport(): ViewportState {
    return this.camera.getState();
  }

  setQuality(q: QualityLevel): void {
    this.quality = q;
    this.applyQualityToDpr();
    this.plugins.broadcastQuality(q);
    this.events.emit("quality:change", q);
    this.scheduler.requestFrame();
  }

  getQuality(): QualityLevel {
    return this.quality;
  }

  getCachePolicy(): CachePolicy {
    return { ...this.cachePolicy };
  }

  setCachePolicy(partial: Partial<CachePolicy>): void {
    this.cachePolicy = { ...this.cachePolicy, ...partial };
    this.scheduler.requestFrame();
  }

  getContainer(): HTMLElement {
    return this.options.container;
  }

  getUiLayer(): HTMLElement {
    return this.uiLayer;
  }

  getDpr(): number {
    return this.dpr;
  }

  getScrollId(): string | null {
    return this.scrollId;
  }

  async ensureThree(): Promise<ThreeOverlayHost | null> {
    if (!this.three?.ensureLoaded) return null;
    await this.three.ensureLoaded();
    const adapter = this.three;
    this.scheduler.requestFrame();
    return {
      attach(object: unknown) {
        adapter.attachOverlay?.(object);
      },
      detach(object: unknown) {
        adapter.detachOverlay?.(object);
      },
    };
  }

  getScene(): SceneDocument | null {
    return this.scene;
  }

  private async mount(): Promise<void> {
    const container = this.options.container;
    container.classList.add("handscroll-viewer");
    container.replaceChildren();

    this.pixi = this.options.adapters.createPixi();
    await this.pixi.mount(container);

    if (this.options.renderers.three) {
      this.three = this.options.adapters.createThree?.() ?? null;
      if (this.three) await this.three.mount(container);
    }

    container.appendChild(this.uiLayer);
    this.resizeToContainer();
    this.applyQualityToDpr();

    this.input = new InputManager(
      container,
      this.camera,
      this.scheduler,
      { captureWheel: true },
      (worldX, worldY) => this.handleClick(worldX, worldY),
    );
    this.input.attach();

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeToContainer();
      this.scheduler.requestFrame();
    });
    this.resizeObserver.observe(container);

    this.scheduler.start((dt) => this.frame(dt));
    this.setQuality(this.quality);
  }

  private frame(dt: number): void {
    this.input?.update(dt);
    this.camera.update(dt);
    if (this.camera.isAnimating()) this.scheduler.requestContinuous("camera");
    else this.scheduler.releaseContinuous("camera");

    const vp = this.camera.getState();
    this.services.tiles.update(vp, this.cachePolicy, this.dpr);
    this.services.animation.update(dt);

    const tiles: readonly VisibleTile[] = this.services.tiles.getVisibleTiles();
    this.pixi?.setTiles?.(tiles);
    this.pixi?.sync(vp);
    this.three?.sync(vp);

    this.plugins.broadcastFrame(dt, vp);

    this.pixi?.render();
    if (this.three?.needsThree?.()) this.three.render();

    if (this.services.tiles.hasPending()) this.scheduler.requestFrame();
  }

  private handleClick(worldX: number, worldY: number): void {
    const hits = this.services.interaction.pickAll(worldX, worldY);
    const top = hits[0];
    if (!top) {
      this.events.emit("world:click", { worldX, worldY });
      return;
    }
    const hit: HitResult = {
      entityId: top.entityId,
      renderer: top.renderer,
      interactionPriority: top.interactionPriority,
      worldX,
      worldY,
    };
    if (this.plugins.dispatchHit(hit)) return;
    this.events.emit("entity:click", hit);
  }

  private resizeToContainer(): void {
    const w = Math.max(1, this.options.container.clientWidth);
    const h = Math.max(1, this.options.container.clientHeight);
    this.camera.setSize(w, h);
    this.applyQualityToDpr();
    this.pixi?.setSize(w, h, this.dpr);
    this.three?.setSize(w, h, this.dpr);
  }

  private applyQualityToDpr(): void {
    const hardware = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cap = this.options.dprMax ?? 2;
    let max = cap;
    if (this.quality === "low") max = Math.min(cap, 1);
    else if (this.quality === "medium") max = Math.min(cap, 1.5);
    else if (this.quality === "high") max = cap;
    else max = Math.min(cap, hardware > 2 ? 1.5 : hardware);
    this.dpr = Math.min(hardware, max);
    const w = Math.max(1, this.options.container.clientWidth);
    const h = Math.max(1, this.options.container.clientHeight);
    this.pixi?.setSize(w, h, this.dpr);
    this.three?.setSize(w, h, this.dpr);
  }

  private async unloadCurrent(): Promise<void> {
    this.storyCleanup?.();
    this.storyCleanup = null;
    await this.plugins.broadcastSceneUnload();
    this.services.tiles.clear();
    this.services.animation.clear();
    this.services.interaction.setEntities([]);
    this.services.assets.cancelAll();
    this.scene = null;
    this.meta = null;
    this.scrollId = null;
    this.events.emit("scene:unload");
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("ScrollEngine has been destroyed");
  }
}
