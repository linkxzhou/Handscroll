import type { FlyToOptions } from "./contracts/viewport.ts";
import type { SceneEntity } from "./contracts/engine.ts";

export interface PanelOpenPayload {
  entityId: string;
  title?: string;
  body?: string;
  i18nKey?: string;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Default hotspot actions after plugins decline the hit and `entity:click` is emitted. */
export function applyHotspotAction(
  entity: SceneEntity,
  emit: (event: string, payload?: unknown) => void,
  flyTo: (opts: FlyToOptions) => void,
): void {
  if (entity.type !== "hotspot" || !entity.action) return;
  const { type, payload } = entity.action;
  if (type === "openPanel") {
    const extra = asRecord(payload);
    const panel: PanelOpenPayload = {
      ...extra,
      entityId: entity.id,
      title: typeof extra.title === "string" ? extra.title : entity.i18nKey,
      body: typeof extra.body === "string" ? extra.body : undefined,
      i18nKey: typeof extra.i18nKey === "string" ? extra.i18nKey : entity.i18nKey,
    };
    emit("panel:open", panel);
    return;
  }
  if (type === "flyTo") {
    const extra = asRecord(payload);
    if (
      typeof extra.centerX === "number" &&
      typeof extra.centerY === "number" &&
      typeof extra.zoom === "number"
    ) {
      flyTo({
        centerX: extra.centerX,
        centerY: extra.centerY,
        zoom: extra.zoom,
        duration: typeof extra.duration === "number" ? extra.duration : 800,
      });
    }
    return;
  }
  if (type === "emit") {
    const extra = asRecord(payload);
    if (typeof extra.event === "string") emit(extra.event, extra.data);
  }
}
