import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { SchedulerLike } from "@handscroll/core";
import { createAtmosphereController } from "./hud.ts";

function mockEngine() {
  const events = new EventBus();
  const scheduler: SchedulerLike = {
    requestFrame: () => {},
    wake: () => {},
    requestContinuous: () => {},
    releaseContinuous: () => {},
  };
  return {
    events,
    scheduler,
    getUiLayer: () => ({ appendChild: (node: unknown) => node }) as HTMLElement,
  };
}

describe("qingming atmosphere hud", () => {
  it("emits weather, water, and tile-night commands without a night overlay", () => {
    const engine = mockEngine();
    const weather: string[] = [];
    const water: boolean[] = [];
    const nights: boolean[] = [];
    engine.events.on("weather:set", (payload) => {
      if (payload && typeof payload === "object" && "id" in payload && typeof (payload as { id: unknown }).id === "string") {
        weather.push((payload as { id: string }).id);
      }
    });
    engine.events.on("water:set", (payload) => {
      if (payload && typeof payload === "object" && "enabled" in payload) {
        water.push(Boolean((payload as { enabled: unknown }).enabled));
      }
    });
    engine.events.on("atmosphere:night", (payload) => {
      if (payload && typeof payload === "object" && "enabled" in payload) {
        nights.push(Boolean((payload as { enabled: unknown }).enabled));
      }
    });
    const atmo = createAtmosphereController(engine);
    expect(atmo.getState().rain).toBe(false);
    expect(atmo.getState().night).toBe(false);
    expect(atmo.getState().water).toBe(true);
    expect(weather.at(-1)).toBe("clear");
    expect(water.at(-1)).toBe(true);
    expect(nights.at(-1)).toBe(false);

    atmo.setRain(true);
    expect(atmo.getState().weather).toBe("rain");
    expect(weather.at(-1)).toBe("rain");
    atmo.setNight(true);
    expect(atmo.getState().night).toBe(true);
    expect(nights.at(-1)).toBe(true);
    atmo.setWater(false);
    expect(water.at(-1)).toBe(false);

    atmo.dispose();
    atmo.dispose();
    expect(atmo.getState().disposed).toBe(true);
    expect(weather.at(-1)).toBe("clear");
    expect(nights.at(-1)).toBe(false);
    atmo.setRain(true);
    expect(atmo.getState().rain).toBe(false);
  });
});
