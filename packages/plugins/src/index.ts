export { builtinPlugins } from "./registry.ts";
export { createQualityPlugin, policyFor, resolveAutoQuality } from "./quality/QualityPlugin.ts";
export { createGuidePlugin } from "./guide/GuidePlugin.ts";
export { createAudioPlugin, isDefaultMuted } from "./audio/AudioPlugin.ts";
export {
  createWeatherPlugin,
  setWeather,
  parseWeatherPayload,
  isWeatherId,
  WEATHER_IDS,
} from "./weather/WeatherPlugin.ts";
export type { WeatherId } from "./weather/WeatherPlugin.ts";
export { createWaterPlugin, parseWaterEnabled, worldRectToScreen } from "./water/WaterPlugin.ts";
export type { WaterBand, WaterPluginConfig } from "./water/WaterPlugin.ts";

