import type { PluginFactory, ScrollPlugin } from "@handscroll/core";

export type WeatherId = "clear" | "rain" | "snow" | "mist";

export const createWeatherPlugin: PluginFactory = (_raw): ScrollPlugin => {
  let weather: WeatherId = "clear";
  return {
    id: "weather",
    onRegister(ctx) {
      ctx.engine.events.on("weather:set", (payload) => {
        weather = (payload as { id?: WeatherId })?.id ?? weather;
      });
    },
    onFrame() {
      /* visual implementation deferred */
    },
  };
};
