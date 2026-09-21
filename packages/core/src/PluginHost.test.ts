import { describe, expect, it } from "vitest";
import { EventBus } from "./EventBus.ts";
import { PluginHost } from "./PluginHost.ts";
import { RenderScheduler } from "./scheduler/RenderScheduler.ts";
import type { EngineContext, ScrollPlugin } from "./contracts/plugin.ts";
import type { HitResult } from "./contracts/hit.ts";
import type { SceneDocument } from "./contracts/engine.ts";

function stubCtx(): EngineContext {
  return {
    engine: {
      events: new EventBus(),
      camera: {
        getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
        flyTo: () => {},
        interruptTransition: () => {},
      },
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
    },
    scene: null,
    quality: "auto",
  };
}

const scene = (id = "demo"): SceneDocument => ({
  version: 1,
  meta: { id, width: 100, height: 50 },
  background: { manifestUrl: "./tiles/manifest.json" },
  entities: [],
  chapters: [],
});

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

  it("unsubscribes via the function returned from on()", () => {
    const bus = new EventBus();
    let n = 0;
    const off = bus.on("x", () => {
      n += 1;
    });
    off();
    bus.emit("x");
    expect(n).toBe(0);
  });

  it("clear drops remaining listeners", () => {
    const bus = new EventBus();
    let n = 0;
    bus.on("x", () => {
      n += 1;
    });
    bus.clear();
    bus.emit("x");
    expect(n).toBe(0);
  });
});

describe("PluginHost P-U-01..04", () => {
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

  it("lets the default path run when no plugin swallows the hit", () => {
    const host = new PluginHost({});
    host.use({ id: "noop", onHit: () => undefined });
    const hit: HitResult = { entityId: "x", renderer: "pixi", interactionPriority: 0, worldX: 1, worldY: 1 };
    expect(host.dispatchHit(hit)).toBe(false);
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

  it("throws on unknown plugin ids when policy is throw", async () => {
    const host = new PluginHost({}, "throw");
    await expect(host.loadBuiltins(["missing"])).rejects.toThrow(/Unknown plugin id "missing"/);
  });

  it("rejects a duplicate plugin id", () => {
    const host = new PluginHost({});
    host.use({ id: "quality" });
    expect(() => host.use({ id: "quality" })).toThrow(/already registered/);
  });

  it("runs scene load then unload hooks", async () => {
    const host = new PluginHost({});
    const log: string[] = [];
    host.use({
      id: "guide",
      onSceneLoad: (s) => {
        log.push(`load:${s.meta.id}`);
      },
      onSceneUnload: () => {
        log.push("unload");
      },
    });
    await host.broadcastSceneLoad(scene("pack-a"));
    await host.broadcastSceneUnload();
    expect(log).toEqual(["load:pack-a", "unload"]);
  });

  it("calls onRegister when use() runs after setContext", () => {
    const host = new PluginHost({});
    host.setContext(stubCtx());
    let registered = 0;
    host.use({
      id: "q",
      onRegister: () => {
        registered += 1;
      },
    });
    expect(registered).toBe(1);
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

  it("stays scheduled while a continuous reason is held", () => {
    const queue: FrameRequestCallback[] = [];
    const scheduler = new RenderScheduler({
      now: () => 0,
      raf: (cb) => {
        queue.push(cb);
        return queue.length;
      },
      caf: () => {},
    });
    scheduler.start(() => {});
    queue.shift()?.(0);
    expect(queue.length).toBe(0);
    scheduler.requestContinuous("pointer");
    expect(queue.length).toBe(1);
    queue.shift()?.(16);
    expect(queue.length).toBe(1);
    scheduler.releaseContinuous("pointer");
    queue.shift()?.(32);
    expect(queue.length).toBe(0);
    scheduler.stop();
  });
});
