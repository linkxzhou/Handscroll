import type { HitResult } from "./hit.ts";
import type { SceneDocument, QualityLevel, ScrollEnginePublic } from "./engine.ts";
import type { ViewportState } from "./viewport.ts";

export interface EngineContext {
  engine: ScrollEnginePublic;
  scene: SceneDocument | null;
  quality: QualityLevel;
}

export interface ScrollPlugin {
  id: string;
  /** Larger numbers receive onHit first and may intercept. */
  priority?: number;
  onRegister?(ctx: EngineContext): void | Promise<void>;
  onSceneLoad?(scene: SceneDocument): void | Promise<void>;
  onSceneUnload?(): void | Promise<void>;
  onFrame?(dt: number, viewport: ViewportState): void;
  /** Return true to swallow the hit. */
  onHit?(hit: HitResult): boolean | void;
  onQualityChange?(q: QualityLevel): void;
  onDestroy?(): void | Promise<void>;
}

export type PluginFactory = (config: unknown) => ScrollPlugin;
