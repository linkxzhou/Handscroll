import type { PluginFactory, ScrollPlugin } from "@handscroll/core";

interface AudioConfig {
  defaultMuted?: boolean;
}

export const createAudioPlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as AudioConfig;
  let muted = config.defaultMuted !== false;
  const unlocked = { current: false };

  return {
    id: "audio",
    priority: 20,
    onRegister(ctx) {
      const unlock = () => {
        unlocked.current = true;
        ctx.engine.getContainer().removeEventListener("pointerdown", unlock);
      };
      ctx.engine.getContainer().addEventListener("pointerdown", unlock, { once: true });
      const onVis = () => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          muted = true;
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVis);
      }
    },
    onDestroy() {
      /* listeners are once/page-level; full audio bus is Phase 2 */
    },
  };
};

export function isDefaultMuted(config: AudioConfig | undefined): boolean {
  return config?.defaultMuted !== false;
}
