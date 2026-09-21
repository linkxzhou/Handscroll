import type { SceneDocument } from "./contracts/engine.ts";

/** Plugins that require the Three overlay to be loaded. */
export const THREE_PLUGIN_IDS = new Set(["water"]);

export function sceneNeedsThree(scene: SceneDocument, plugins: readonly string[] = []): boolean {
  if (scene.entities.some((entity) => entity.type === "model3d")) return true;
  return plugins.some((id) => THREE_PLUGIN_IDS.has(id));
}
