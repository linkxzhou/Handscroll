import type { EngineContext, ScrollPlugin } from "./contracts/plugin.ts";
import type { HitResult } from "./contracts/hit.ts";
import type { SceneDocument } from "./contracts/engine.ts";
import type { ViewportState } from "./contracts/viewport.ts";

export class PluginHost {
  private plugins: ScrollPlugin[] = [];
  private ctx: EngineContext | null = null;
  private readonly registry: Record<string, (config: unknown) => ScrollPlugin>;
  private unknownPluginPolicy: "warn" | "throw";

  constructor(
    registry: Record<string, (config: unknown) => ScrollPlugin>,
    unknownPluginPolicy: "warn" | "throw" = "warn",
  ) {
    this.registry = registry;
    this.unknownPluginPolicy = unknownPluginPolicy;
  }

  setContext(ctx: EngineContext): void {
    this.ctx = ctx;
  }

  listIds(): string[] {
    return this.plugins.map((p) => p.id);
  }

  use(plugin: ScrollPlugin): void {
    if (this.plugins.some((p) => p.id === plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    this.plugins.push(plugin);
    this.sort();
    if (this.ctx) {
      void plugin.onRegister?.(this.ctx);
    }
  }

  async loadBuiltins(ids: string[], pluginConfig?: Record<string, unknown>): Promise<void> {
    await this.destroyAll();
    for (const id of ids) {
      const factory = this.registry[id];
      if (!factory) {
        const message = `Unknown plugin id "${id}". Known: ${Object.keys(this.registry).join(", ") || "(none)"}`;
        if (this.unknownPluginPolicy === "throw") throw new Error(message);
        console.warn(`[handscroll] ${message} — skipping`);
        continue;
      }
      const plugin = factory(pluginConfig?.[id]);
      this.plugins.push(plugin);
    }
    this.sort();
    if (this.ctx) {
      for (const plugin of this.plugins) {
        await plugin.onRegister?.(this.ctx);
      }
    }
  }

  async broadcastSceneLoad(scene: SceneDocument): Promise<void> {
    if (this.ctx) this.ctx.scene = scene;
    for (const plugin of this.plugins) {
      await plugin.onSceneLoad?.(scene);
    }
  }

  async broadcastSceneUnload(): Promise<void> {
    for (const plugin of [...this.plugins].reverse()) {
      await plugin.onSceneUnload?.();
    }
    if (this.ctx) this.ctx.scene = null;
  }

  broadcastFrame(dt: number, viewport: ViewportState): void {
    for (const plugin of this.plugins) {
      plugin.onFrame?.(dt, viewport);
    }
  }

  broadcastQuality(quality: EngineContext["quality"]): void {
    if (this.ctx) this.ctx.quality = quality;
    for (const plugin of this.plugins) {
      plugin.onQualityChange?.(quality);
    }
  }

  /** Returns true if a plugin swallowed the hit. */
  dispatchHit(hit: HitResult): boolean {
    for (const plugin of this.plugins) {
      if (plugin.onHit?.(hit) === true) return true;
    }
    return false;
  }

  async destroyAll(): Promise<void> {
    const current = [...this.plugins].reverse();
    this.plugins = [];
    for (const plugin of current) {
      await plugin.onDestroy?.();
    }
  }

  private sort(): void {
    this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
}
