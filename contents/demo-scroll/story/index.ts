import type { HitResult, ScrollEnginePublic, StoryCleanup } from "@handscroll/core";

function isHit(value: unknown): value is HitResult {
  return Boolean(value && typeof value === "object" && "entityId" in (value as object));
}

/**
 * Demo pack story: click the gate hotspot to fly in. Panel copy comes from the
 * hotspot `openPanel` action (engine default). Keep painting-specific plot here,
 * never in `packages/core`.
 */
export function registerStory(engine: ScrollEnginePublic): StoryCleanup {
  const offClick = engine.on("entity:click", (raw) => {
    if (!isHit(raw) || raw.entityId !== "gate-plaque") return;
    engine.camera.flyTo({
      centerX: 1760,
      centerY: 310,
      zoom: 1.05,
      duration: 700,
    });
    engine.scheduler.requestContinuous("camera");
    engine.scheduler.requestFrame();
  });

  const offUnload = engine.on("scene:unload", () => {
    cleanup();
  });

  function cleanup(): void {
    offClick();
    offUnload();
  }

  return cleanup;
}
