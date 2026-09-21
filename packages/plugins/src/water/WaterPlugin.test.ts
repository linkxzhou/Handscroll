import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext, ViewportState } from "@handscroll/core";
import {
  createWaterPlugin,
  parseWaterEnabled,
  WATER_CONTINUOUS_REASON,
  worldRectToScreen,
} from "./WaterPlugin.ts";

const vp: ViewportState = { centerX: 100, centerY: 50, zoom: 2, screenWidth: 200, screenHeight: 100 };

function stubCtx(options: { ensureThree?: EngineContext["engine"]["ensureThree"] } = {}): EngineContext & {
  continuous: Set<string>;
} {
  const events = new EventBus();
  const continuous = new Set<string>();
  return {
    continuous,
    engine: {
      events,
      camera: {
        getState: () => vp,
        flyTo: () => {},
        interruptTransition: () => {},
      },
      scheduler: {
        requestFrame: () => {},
        wake: () => {},
        requestContinuous: (reason: string) => {
          continuous.add(reason);
        },
        releaseContinuous: (reason: string) => {
          continuous.delete(reason);
        },
      },
      getViewport: () => vp,
      setQuality: () => {},
      getQuality: () => "auto",
      getCachePolicy: () => ({
        gpuBudgetBytes: 1,
        decodedBudgetBytes: 1,
        maxConcurrentRequests: 1,
        maxUploadsPerFrame: 1,
      }),
      setCachePolicy: () => {},
      getContainer: () => ({}) as HTMLElement,
      getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
      getDpr: () => 1,
      getScrollId: () => "fixture",
      ensureThree: options.ensureThree ?? (async () => null),
    },
    scene: null,
    quality: "auto",
  };
}

describe("water plugin", () => {
  it("maps a world band through the viewport without drift at the origin", () => {
    const box = worldRectToScreen(vp, { x: 100, y: 50, w: 40, h: 20 });
    expect(box.left).toBe(100);
    expect(box.top).toBe(50);
    expect(box.width).toBe(80);
    expect(box.height).toBe(40);
  });

  it("parses water:set payloads", () => {
    expect(parseWaterEnabled({ enabled: false }, true)).toBe(false);
    expect(parseWaterEnabled({ enabled: true }, false)).toBe(true);
    expect(parseWaterEnabled(false, true)).toBe(false);
    expect(parseWaterEnabled("x", true)).toBe(true);
  });

  it("does not crash when Three is unavailable and empty bands stay quiet", async () => {
    const quiet = createWaterPlugin({ enabled: true, bands: [] });
    const ctx = stubCtx();
    const infos: string[] = [];
    const orig = console.info;
    console.info = (msg?: unknown) => {
      infos.push(String(msg));
    };
    try {
      await quiet.onRegister?.(ctx);
      await quiet.onSceneLoad?.({
        version: 1,
        meta: { id: "x", width: 1, height: 1 },
        background: { manifestUrl: "./tiles/manifest.json" },
        entities: [],
        chapters: [],
      });
      quiet.onFrame?.(0.016, vp);
      ctx.engine.events.emit("water:set", { enabled: true });
      await quiet.onDestroy?.();
    } finally {
      console.info = orig;
    }
    expect(ctx.continuous.has(WATER_CONTINUOUS_REASON)).toBe(false);
    expect(infos.some((m) => m.includes("stub"))).toBe(false);
  });

  it("falls back without throwing when ensureThree returns null", async () => {
    const plugin = createWaterPlugin({
      enabled: true,
      bands: [{ x: 0, y: 520, w: 100, h: 40 }],
    });
    const ctx = stubCtx({ ensureThree: async () => null });
    await plugin.onRegister?.(ctx);
    await plugin.onSceneLoad?.({
      version: 1,
      meta: { id: "x", width: 1, height: 1 },
      background: { manifestUrl: "./tiles/manifest.json" },
      entities: [],
      chapters: [],
    });
    plugin.onFrame?.(0.016, vp);
    ctx.engine.events.emit("water:set", { enabled: false });
    ctx.engine.events.emit("water:set", { enabled: true });
    await plugin.onSceneUnload?.();
    await plugin.onDestroy?.();
    expect(ctx.continuous.has(WATER_CONTINUOUS_REASON)).toBe(false);
  });
});
