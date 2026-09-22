import type { EngineContext, PluginFactory, ScrollPlugin } from "@handscroll/core";

export const CROWD_CONTINUOUS_REASON = "crowd";

export interface CrowdConfig {
  enabled?: boolean;
  /** i18n key → resolved copy. The plugin does not load a content pack. */
  text?: Record<string, string>;
}

/**
 * Turns scene spawns into actors and cycles label copy.
 * Path stepping and culling stay in the world simulator.
 */
export const createCrowdPlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as CrowdConfig;
  const enabled = config.enabled !== false;
  const dictionary = config.text ?? {};
  const clocks = new Map<string, number>();
  let ctx: EngineContext | null = null;

  const syncLabels = (dt: number): boolean => {
    const world = ctx?.world;
    if (!world) return false;
    let cycling = false;
    for (const track of world.labelTracks()) {
      if (!track.active || track.keys.length === 0 || track.seconds <= 0) continue;
      cycling = true;
      const elapsed = (clocks.get(track.id) ?? 0) + dt;
      clocks.set(track.id, elapsed);
      const index = Math.floor((elapsed + track.offset) / track.seconds) % track.keys.length;
      const key = track.keys[index] ?? track.keys[0]!;
      world.setLabel(track.id, dictionary[key] ?? key);
    }
    return cycling;
  };

  return {
    id: "crowd",
    priority: 6,
    onRegister(next) {
      ctx = next;
    },
    onSceneLoad() {
      if (!enabled) return;
      ctx?.world?.setSpawnsEnabled(true);
      const cycling = syncLabels(0);
      if (cycling) ctx?.engine.scheduler.requestContinuous(CROWD_CONTINUOUS_REASON);
      ctx?.engine.scheduler.requestFrame();
    },
    onFrame(dt) {
      if (!enabled) return;
      if (syncLabels(dt)) ctx?.engine.scheduler.requestContinuous(CROWD_CONTINUOUS_REASON);
      else ctx?.engine.scheduler.releaseContinuous(CROWD_CONTINUOUS_REASON);
    },
    onSceneUnload() {
      clocks.clear();
      ctx?.engine.scheduler.releaseContinuous(CROWD_CONTINUOUS_REASON);
      ctx?.world?.setSpawnsEnabled(false);
    },
    onDestroy() {
      clocks.clear();
      ctx?.engine.scheduler.releaseContinuous(CROWD_CONTINUOUS_REASON);
      ctx = null;
    },
  };
};
