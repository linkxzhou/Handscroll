import type { PluginFactory } from "@handscroll/core";
import { createQualityPlugin } from "./quality/QualityPlugin.ts";
import { createGuidePlugin } from "./guide/GuidePlugin.ts";
import { createAudioPlugin } from "./audio/AudioPlugin.ts";
import { createWeatherPlugin } from "./weather/WeatherPlugin.ts";
import { createWaterPlugin } from "./water/WaterPlugin.ts";

export const builtinPlugins: Record<string, PluginFactory> = {
  quality: createQualityPlugin,
  guide: createGuidePlugin,
  audio: createAudioPlugin,
  weather: createWeatherPlugin,
  water: createWaterPlugin,
};
