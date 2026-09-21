import { describe, expect, it } from "vitest";
import type { SceneEntity } from "./contracts/engine.ts";
import { applyHotspotAction } from "./hotspotAction.ts";

const hotspot = (action: SceneEntity extends { action?: infer A } ? A : never): SceneEntity => ({
  id: "gate-plaque",
  type: "hotspot",
  x: 10,
  y: 10,
  shape: { kind: "rect", w: 20, h: 10 },
  action,
});

describe("applyHotspotAction", () => {
  it("emits panel:open for openPanel hotspots", () => {
    const events: { event: string; payload: unknown }[] = [];
    applyHotspotAction(
      hotspot({ type: "openPanel", payload: { title: "City gate", body: "A plaque." } }),
      (event, payload) => events.push({ event, payload }),
      () => {
        throw new Error("should not fly");
      },
    );
    expect(events).toEqual([
      {
        event: "panel:open",
        payload: {
          entityId: "gate-plaque",
          title: "City gate",
          body: "A plaque.",
          i18nKey: undefined,
        },
      },
    ]);
  });

  it("calls flyTo when the action payload has a camera target", () => {
    const flew: unknown[] = [];
    applyHotspotAction(
      hotspot({ type: "flyTo", payload: { centerX: 100, centerY: 50, zoom: 0.8 } }),
      () => {
        throw new Error("should not emit");
      },
      (opts) => flew.push(opts),
    );
    expect(flew).toEqual([{ centerX: 100, centerY: 50, zoom: 0.8, duration: 800 }]);
  });

  it("forwards custom emit actions", () => {
    const events: { event: string; payload: unknown }[] = [];
    applyHotspotAction(
      hotspot({ type: "emit", payload: { event: "story:flag", data: { ok: true } } }),
      (event, payload) => events.push({ event, payload }),
      () => {
        throw new Error("should not fly");
      },
    );
    expect(events).toEqual([{ event: "story:flag", payload: { ok: true } }]);
  });

  it("ignores sprites and none actions", () => {
    applyHotspotAction(
      { id: "s", type: "sprite", x: 0, y: 0, url: "x.png" },
      () => {
        throw new Error("should not emit");
      },
      () => {
        throw new Error("should not fly");
      },
    );
    applyHotspotAction(
      hotspot({ type: "none" }),
      () => {
        throw new Error("should not emit");
      },
      () => {
        throw new Error("should not fly");
      },
    );
  });
});
