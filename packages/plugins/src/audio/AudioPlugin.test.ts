import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext } from "@handscroll/core";
import { createAudioPlugin, isDefaultMuted } from "./AudioPlugin.ts";

function stubCtx(): EngineContext {
  const events = new EventBus();
  return {
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
        requestContinuous: () => {},
        releaseContinuous: () => {},
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
      getContainer: () => ({ addEventListener: () => {}, removeEventListener: () => {} }) as unknown as HTMLElement,
      getUiLayer: () => ({}) as HTMLElement,
      getDpr: () => 1,
      getScrollId: () => null,
      ensureThree: async () => null,
    },
    scene: null,
    quality: "auto",
  };
}

describe("audio plugin", () => {
  it("defaults to muted", () => {
    expect(isDefaultMuted(undefined)).toBe(true);
    expect(isDefaultMuted({ defaultMuted: true })).toBe(true);
    expect(isDefaultMuted({ defaultMuted: false })).toBe(false);
  });

  it("play before unlock does not throw", async () => {
    const plugin = createAudioPlugin({ defaultMuted: true });
    const ctx = stubCtx();
    await plugin.onRegister?.(ctx);
    expect(() => ctx.engine.events.emit("audio:play", { id: "rain", kind: "rain" })).not.toThrow();
    expect(() => ctx.engine.events.emit("audio:play", { id: "water", kind: "water" })).not.toThrow();
    expect(() => ctx.engine.events.emit("audio:stop", { id: "rain" })).not.toThrow();
    expect(() => ctx.engine.events.emit("audio:setMuted", { muted: false })).not.toThrow();
    await plugin.onSceneUnload?.();
    await plugin.onDestroy?.();
  });
});
