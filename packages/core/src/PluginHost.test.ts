import { describe, expect, it } from "vitest";
import { EventBus } from "./EventBus.ts";
import { PluginHost } from "./PluginHost.ts";
import { RenderScheduler } from "./scheduler/RenderScheduler.ts";
import type { EngineContext, ScrollPlugin } from "./contracts/plugin.ts";
import type { HitResult } from "./contracts/hit.ts";

function stubCtx(): EngineContext {
  return {
    engine: {
      events: new EventBus(),
      camera: { getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }), flyTo: () => {}, interruptTransition: () => {} },
      scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
      getViewport: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
      setQuality: () => {},
      getQuality: () => "auto",
      getCachePolicy: () => ({
        gpuBudgetBytes: 1,
        decodedBudgetBytes: 1,
        maxConcurrentRequests: 1,
        maxUploadsPerFrame: 1,
      }),
      setCachePolicy: () => {},
      getContainer: () => ({}) as HTMLElement,
      getUiLayer: () => ({}) as HTMLElement,
      getDpr: () => 1,
      getScrollId: () => null,
      ensureThree: async () => null,
    },
    scene: null,
    quality: "auto",
  };
}

describe("EventBus E-U-13", () => {
  it("does not call handlers after off", () => {
    const bus = new EventBus();
    let n = 0;
    const handler = () => {
      n += 1;
    };
    bus.on("ping", handler);
    bus.emit("ping");
    bus.off("ping", handler);
    bus.emit("ping");
    expect(n).toBe(1);
  });
});

describe("PluginHost P-U-01..03", () => {
  it("broadcasts frames in priority order (P-U-01)", () => {
    const host = new PluginHost({});
    host.setContext(stubCtx());
    const order: string[] = [];
    const a: ScrollPlugin = { id: "a", priority: 1, onFrame: () => order.push("a") };
    const b: ScrollPlugin = { id: "b", priority: 10, onFrame: () => order.push("b") };
    host.use(a);
    host.use(b);
    host.broadcastFrame(0.016, { centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 });
    expect(order).toEqual(["b", "a"]);
  });

  it("stops hit dispatch when a plugin returns true (P-U-02)", () => {
    const host = new PluginHost({});
    const hits: string[] = [];
    host.use({
      id: "first",
      priority: 2,
      onHit: () => {
        hits.push("first");
        return true;
      },
    });
    host.use({
      id: "second",
      priority: 1,
      onHit: () => {
        hits.push("second");
      },
    });
    const hit: HitResult = { entityId: "x", renderer: "pixi", interactionPriority: 0, worldX: 0, worldY: 0 };
    const swallowed = host.dispatchHit(hit);
    expect(swallowed).toBe(true);
    expect(hits).toEqual(["first"]);
  });

  it("destroyAll calls onDestroy and later frames are skipped (P-U-03)", async () => {
    const host = new PluginHost({});
    let frames = 0;
    let destroyed = 0;
    host.use({
      id: "p",
      onFrame: () => {
        frames += 1;
      },
      onDestroy: () => {
        destroyed += 1;
      },
    });
    await host.destroyAll();
    host.broadcastFrame(0.016, { centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 });
    expect(destroyed).toBe(1);
    expect(frames).toBe(0);
  });

  it("skips unknown plugin ids with a warning (P-U-04)", async () => {
    const host = new PluginHost({ known: () => ({ id: "known" }) }, "warn");
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg?: unknown) => {
      warns.push(String(msg));
    };
    try {
      await host.loadBuiltins(["nope", "known"]);
    } finally {
      console.warn = orig;
    }
    expect(host.listIds()).toEqual(["known"]);
    expect(warns.some((w) => w.includes("nope"))).toBe(true);
  });
});

describe("RenderScheduler E-U-12", () => {
  it("on-demand wake runs exactly one frame unless the loop requests more", () => {
    const queue: FrameRequestCallback[] = [];
    const scheduler = new RenderScheduler({
      now: () => 1000,
      raf: (cb) => {
        queue.push(cb);
        return queue.length;
      },
      caf: () => {
        queue.length = 0;
      },
    });
    let frames = 0;
    scheduler.start(() => {
      frames += 1;
    });
    expect(queue.length).toBe(1);
    queue.shift()?.(1000);
    expect(frames).toBe(1);
    expect(queue.length).toBe(0);

    scheduler.wake();
    expect(queue.length).toBe(1);
    queue.shift()?.(1016);
    expect(frames).toBe(2);
    expect(queue.length).toBe(0);
    scheduler.stop();
  });
});
