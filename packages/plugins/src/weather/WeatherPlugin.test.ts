import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext } from "@handscroll/core";
import {
  createWeatherPlugin,
  parseWeatherPayload,
  setWeather,
  WEATHER_CONTINUOUS_REASON,
  type WeatherId,
} from "./WeatherPlugin.ts";

function stubCtx(): EngineContext & { continuous: Set<string> } {
  const events = new EventBus();
  const continuous = new Set<string>();
  const ctx: EngineContext & { continuous: Set<string> } = {
    continuous,
    engine: {
      events,
      camera: {
        getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
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
      getViewport: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
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
      ensureThree: async () => null,
    },
    scene: null,
    quality: "auto",
  };
  return ctx;
}

describe("weather plugin", () => {
  it("exposes a callable setWeather API", () => {
    const events = new EventBus();
    const seen: WeatherId[] = [];
    events.on("weather:set", (payload) => {
      const id = parseWeatherPayload(payload);
      if (id) seen.push(id);
    });
    setWeather(events, "rain");
    setWeather(events, "clear");
    expect(seen).toEqual(["rain", "clear"]);
  });

  it("round-trips clear ↔ rain via weather:set and does not crash without DOM visuals", async () => {
    const plugin = createWeatherPlugin({});
    const ctx = stubCtx();
    const changed: WeatherId[] = [];
    ctx.engine.events.on("weather:change", (payload) => {
      const id = parseWeatherPayload(payload);
      if (id) changed.push(id);
    });
    await plugin.onRegister?.(ctx);
    expect(() => setWeather(ctx.engine.events, "rain")).not.toThrow();
    expect(changed).toEqual(["rain"]);
    expect(ctx.continuous.has(WEATHER_CONTINUOUS_REASON)).toBe(true);
    setWeather(ctx.engine.events, "clear");
    expect(changed).toEqual(["rain", "clear"]);
    expect(ctx.continuous.has(WEATHER_CONTINUOUS_REASON)).toBe(false);
    setWeather(ctx.engine.events, "mist");
    setWeather(ctx.engine.events, "rain");
    setWeather(ctx.engine.events, "clear");
    expect(changed.at(-1)).toBe("clear");
    plugin.onFrame?.(0.016, ctx.engine.getViewport());
    await plugin.onSceneUnload?.();
    await plugin.onDestroy?.();
    expect(ctx.continuous.has(WEATHER_CONTINUOUS_REASON)).toBe(false);
  });

  it("ignores unknown weather ids", async () => {
    const plugin = createWeatherPlugin({});
    const ctx = stubCtx();
    const changed: unknown[] = [];
    ctx.engine.events.on("weather:change", (payload) => changed.push(payload));
    await plugin.onRegister?.(ctx);
    ctx.engine.events.emit("weather:set", { id: "hail" });
    ctx.engine.events.emit("weather:set", "nope");
    expect(changed).toEqual([]);
    await plugin.onDestroy?.();
  });
});
