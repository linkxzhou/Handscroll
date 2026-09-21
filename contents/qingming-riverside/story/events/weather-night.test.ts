import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { SchedulerLike } from "@handscroll/core";
import { createAtmosphereController } from "./weather-night.ts";

function mockEngine() {
  const events = new EventBus();
  const continuous = new Set<string>();
  const scheduler: SchedulerLike = {
    requestFrame: () => {},
    wake: () => {},
    requestContinuous: (reason: string) => {
      continuous.add(reason);
    },
    releaseContinuous: (reason: string) => {
      continuous.delete(reason);
    },
  };
  return {
    events,
    continuous,
    scheduler,
    getUiLayer: () => ({ appendChild: (n: unknown) => n }) as HTMLElement,
  };
}

describe("qingming atmosphere", () => {
  it("round-trips 时雨 via weather:set and restores clear on dispose", () => {
    const engine = mockEngine();
    const weather: string[] = [];
    const water: boolean[] = [];
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
    const atmo = createAtmosphereController(engine);
    expect(atmo.getState().rain).toBe(false);
    expect(atmo.getState().night).toBe(false);
    expect(atmo.getState().water).toBe(true);
    expect(atmo.getState().muted).toBe(true);
    expect(weather.at(-1)).toBe("clear");
    expect(water.at(-1)).toBe(true);

    atmo.setRain(true);
    expect(atmo.getState().weather).toBe("rain");
    expect(weather.at(-1)).toBe("rain");
    atmo.setRain(false);
    expect(atmo.getState().weather).toBe("clear");
    expect(weather.at(-1)).toBe("clear");

    atmo.setNight(true);
    expect(atmo.getState().night).toBe(true);
    atmo.setWater(false);
    expect(water.at(-1)).toBe(false);

    atmo.dispose();
    atmo.dispose();
    expect(atmo.getState().disposed).toBe(true);
    expect(atmo.getState().rain).toBe(false);
    expect(weather.at(-1)).toBe("clear");
    atmo.setRain(true);
    expect(atmo.getState().rain).toBe(false);
  });
});
