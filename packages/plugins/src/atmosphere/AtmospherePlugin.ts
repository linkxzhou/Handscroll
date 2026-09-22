import type { EngineContext, PluginFactory, ScrollPlugin } from "@handscroll/core";

export const ATMOSPHERE_CONTINUOUS_REASON = "atmosphere";

/** Starting darkness for `atmosphere:night`. Tuned toward a half-strength cool multiply. */
export const DEFAULT_NIGHT_DARKNESS = 0.55;

export interface AtmosphereGradientStop {
  /** 0–1 time of day. */
  t: number;
  darkness: number;
}

export interface AtmosphereConfig {
  gradeActors?: boolean;
  nightDarkness?: number;
  /** When set, `time:ofday` maps onto the same tile grade. Ignored otherwise. */
  gradient?: AtmosphereGradientStop[];
}

/**
 * Night is a tile-layer grade. This plugin does not insert a screen-space wash.
 * Rain, snow, and mist stay on the weather plugin.
 */
export const createAtmospherePlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as AtmosphereConfig;
  const gradeActors = config.gradeActors === true;
  const nightDarkness = clamp01(config.nightDarkness ?? DEFAULT_NIGHT_DARKNESS);
  let ctx: EngineContext | null = null;
  const offs: Array<() => void> = [];

  const apply = (darkness: number): void => {
    ctx?.engine.setTileGrade?.({ darkness: clamp01(darkness), gradeActors });
    ctx?.engine.scheduler.requestFrame();
  };

  return {
    id: "atmosphere",
    priority: 14,
    onRegister(next) {
      ctx = next;
      offs.push(
        next.engine.events.on("atmosphere:night", (payload) => {
          apply(readEnabled(payload) ? nightDarkness : 0);
        }),
      );
      offs.push(
        next.engine.events.on("atmosphere:grade", (payload) => {
          const darkness = readDarkness(payload);
          if (darkness == null) return;
          apply(darkness);
        }),
      );
      offs.push(
        next.engine.events.on("time:ofday", (payload) => {
          if (!config.gradient || config.gradient.length === 0) return;
          const value = readTime(payload);
          if (value == null) return;
          apply(sampleGradient(config.gradient, value));
        }),
      );
    },
    onSceneUnload() {
      apply(0);
      ctx?.engine.scheduler.releaseContinuous(ATMOSPHERE_CONTINUOUS_REASON);
    },
    onDestroy() {
      for (const off of offs) off();
      offs.length = 0;
      apply(0);
      ctx?.engine.scheduler.releaseContinuous(ATMOSPHERE_CONTINUOUS_REASON);
      ctx = null;
    },
  };
};

export function sampleGradient(stops: readonly AtmosphereGradientStop[], time: number): number {
  const t = clamp01(time);
  const ordered = [...stops].sort((a, b) => a.t - b.t);
  const first = ordered[0]!;
  if (t <= first.t) return clamp01(first.darkness);
  for (let i = 1; i < ordered.length; i += 1) {
    const a = ordered[i - 1]!;
    const b = ordered[i]!;
    if (t <= b.t) {
      const span = b.t - a.t;
      const u = span === 0 ? 0 : (t - a.t) / span;
      return clamp01(a.darkness + (b.darkness - a.darkness) * u);
    }
  }
  return clamp01(ordered[ordered.length - 1]!.darkness);
}

function readEnabled(payload: unknown): boolean {
  if (typeof payload === "boolean") return payload;
  if (payload && typeof payload === "object" && "enabled" in payload) {
    return Boolean((payload as { enabled: unknown }).enabled);
  }
  return false;
}

function readDarkness(payload: unknown): number | null {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (payload && typeof payload === "object" && "darkness" in payload) {
    const darkness = (payload as { darkness: unknown }).darkness;
    if (typeof darkness === "number" && Number.isFinite(darkness)) return darkness;
  }
  return null;
}

function readTime(payload: unknown): number | null {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (payload && typeof payload === "object" && "value" in payload) {
    const value = (payload as { value: unknown }).value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
