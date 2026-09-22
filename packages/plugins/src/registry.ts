import type { PluginFactory } from "@handscroll/core";
import { createQualityPlugin } from "./quality/QualityPlugin.ts";
import { createGuidePlugin } from "./guide/GuidePlugin.ts";
import { createAudioPlugin } from "./audio/AudioPlugin.ts";
import { createWeatherPlugin } from "./weather/WeatherPlugin.ts";
import { createWaterPlugin } from "./water/WaterPlugin.ts";
import { createAtmospherePlugin } from "./atmosphere/AtmospherePlugin.ts";
import { createCrowdPlugin } from "./crowd/CrowdPlugin.ts";
import { createVesselPlugin } from "./vessel/VesselPlugin.ts";

export const builtinPlugins: Record<string, PluginFactory> = {
  quality: createQualityPlugin,
  guide: createGuidePlugin,
  audio: createAudioPlugin,
  weather: createWeatherPlugin,
  water: createWaterPlugin,
  atmosphere: createAtmospherePlugin,
  crowd: createCrowdPlugin,
  vessel: createVesselPlugin,
};
