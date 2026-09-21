import type { SchedulerLike, ViewportState } from "@handscroll/core";
import {
  SHOPS,
  STREET_PATHS,
  inActiveZone,
  pointAlong,
  polylineLength,
  worldToScreen,
  type WorldPoint,
} from "../coords.ts";
import zh from "../../i18n/zh-CN.json";

type Copy = Record<string, string>;
const copy = zh as Copy;

export const STREET_CONTINUOUS_REASON = "qingming:street";
export const SHOP_LOOP_SECONDS = 2.8;
export const ACTIVE_MARGIN = 320;

export interface StreetWalkerSnapshot {
  id: string;
  x: number;
  y: number;
  active: boolean;
  culled: boolean;
  path: keyof typeof STREET_PATHS;
}

export interface StreetLifeSnapshot {
  walkers: StreetWalkerSnapshot[];
  shops: { id: string; label: string }[];
  disposed: boolean;
}

export interface StreetLifeEngine {
  scheduler: SchedulerLike;
  getViewport(): ViewportState;
  getUiLayer(): HTMLElement;
}

export interface StreetLifeController {
  step(dt: number): void;
  dispose(): void;
  getState(): StreetLifeSnapshot;
}

interface Walker {
  id: string;
  path: keyof typeof STREET_PATHS;
  points: WorldPoint[];
  length: number;
  distance: number;
  speed: number;
  dir: 1 | -1;
  x: number;
  y: number;
  hue: string;
  el: HTMLElement | null;
}

interface Shop {
  id: string;
  x: number;
  y: number;
  labels: string[];
  index: number;
  elapsed: number;
  el: HTMLElement | null;
}

const WALKER_SEEDS: Array<{ id: string; path: keyof typeof STREET_PATHS; t: number; speed: number; hue: string }> = [
  { id: "ped-tea-a", path: "teahouse", t: 0.08, speed: 28, hue: "#3a2a22" },
  { id: "ped-tea-b", path: "teahouse", t: 0.42, speed: 22, hue: "#5c4633" },
  { id: "ped-tea-c", path: "teahouse", t: 0.78, speed: 32, hue: "#2c241c" },
  { id: "ped-bridge-a", path: "bridge", t: 0.12, speed: 24, hue: "#4a382c" },
  { id: "ped-bridge-b", path: "bridge", t: 0.55, speed: 18, hue: "#6b5340" },
  { id: "ped-bridge-c", path: "bridge", t: 0.88, speed: 26, hue: "#3a2a22" },
  { id: "ped-gate-a", path: "gate", t: 0.2, speed: 30, hue: "#5c4633" },
  { id: "ped-gate-b", path: "gate", t: 0.7, speed: 20, hue: "#2c241c" },
];

export function createStreetLifeController(
  engine: StreetLifeEngine,
  options: { autoTick?: boolean } = {},
): StreetLifeController {
  let disposed = false;
  let raf = 0;
  let lastNow = 0;
  const autoTick = options.autoTick ?? typeof requestAnimationFrame === "function";
  const ui = engine.getUiLayer();

  const walkers: Walker[] = WALKER_SEEDS.map((seed) => {
    const points = STREET_PATHS[seed.path].map((p) => ({ x: p.x, y: p.y }));
    const length = Math.max(1, polylineLength(points));
    const pose = pointAlong(points, seed.t * length);
    return {
      id: seed.id,
      path: seed.path,
      points,
      length,
      distance: seed.t * length,
      speed: seed.speed,
      dir: 1,
      x: pose.x,
      y: pose.y,
      hue: seed.hue,
      el: mountWalker(ui, seed.hue),
    };
  });

  const shops: Shop[] = [
    {
      id: "shop-teahouse",
      x: SHOPS.teahouse.x,
      y: SHOPS.teahouse.y,
      labels: [copy["shop.teahouse"] ?? "茶肆", copy["shop.teahouseBusy"] ?? "客满", copy["shop.teahousePour"] ?? "斟茶"],
      index: 0,
      elapsed: 0,
      el: mountShop(ui, copy["shop.teahouse"] ?? "茶肆"),
    },
    {
      id: "shop-bridge",
      x: SHOPS.bridgeStall.x,
      y: SHOPS.bridgeStall.y,
      labels: [copy["shop.bridge"] ?? "桥头摊", copy["shop.bridgeFruit"] ?? "卖果"],
      index: 0,
      elapsed: 0.6,
      el: mountShop(ui, copy["shop.bridge"] ?? "桥头摊"),
    },
    {
      id: "shop-gate",
      x: SHOPS.gateStall.x,
      y: SHOPS.gateStall.y,
      labels: [copy["shop.gate"] ?? "货摊", copy["shop.gateGrain"] ?? "籴米"],
      index: 0,
      elapsed: 1.2,
      el: mountShop(ui, copy["shop.gate"] ?? "货摊"),
    },
  ];

  const stopTick = (): void => {
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
    lastNow = 0;
  };

  const layout = (walker: Walker, vp: ViewportState, active: boolean, culled: boolean): void => {
    if (!walker.el) return;
    walker.el.hidden = culled;
    walker.el.classList.toggle("is-idle", !active && !culled);
    walker.el.style.transform = `scaleX(${walker.dir})`;
    const screen = worldToScreen(vp, walker.x, walker.y);
    const s = Math.max(0.7, vp.zoom);
    walker.el.style.left = `${screen.x}px`;
    walker.el.style.top = `${screen.y}px`;
    walker.el.style.width = `${7 * s}px`;
    walker.el.style.height = `${16 * s}px`;
  };

  const layoutShop = (shop: Shop, vp: ViewportState, active: boolean): void => {
    if (!shop.el) return;
    shop.el.hidden = !active;
    const screen = worldToScreen(vp, shop.x, shop.y);
    shop.el.style.left = `${screen.x}px`;
    shop.el.style.top = `${screen.y}px`;
    shop.el.textContent = shop.labels[shop.index] ?? shop.labels[0] ?? "";
  };

  const snapshot = (): StreetLifeSnapshot => {
    const vp = engine.getViewport();
    return {
      disposed,
      walkers: walkers.map((w) => {
        const active = inActiveZone(w.x, w.y, vp, ACTIVE_MARGIN);
        const culled = !inActiveZone(w.x, w.y, vp, ACTIVE_MARGIN * 2);
        return { id: w.id, x: w.x, y: w.y, active, culled, path: w.path };
      }),
      shops: shops.map((s) => ({ id: s.id, label: s.labels[s.index] ?? "" })),
    };
  };

  const step = (dt: number): void => {
    if (disposed || dt < 0) return;
    const vp = engine.getViewport();
    let anyActive = false;

    for (const walker of walkers) {
      const active = inActiveZone(walker.x, walker.y, vp, ACTIVE_MARGIN);
      const culled = !inActiveZone(walker.x, walker.y, vp, ACTIVE_MARGIN * 2);
      if (active && dt > 0) {
        walker.distance += walker.speed * walker.dir * dt;
        if (walker.distance >= walker.length) {
          walker.distance = walker.length;
          walker.dir = -1;
        } else if (walker.distance <= 0) {
          walker.distance = 0;
          walker.dir = 1;
        }
        const pose = pointAlong(walker.points, walker.distance);
        walker.x = pose.x;
        walker.y = pose.y;
        anyActive = true;
      } else if (active) {
        anyActive = true;
      }
      layout(walker, vp, active, culled);
    }

    for (const shop of shops) {
      const active = inActiveZone(shop.x, shop.y, vp, ACTIVE_MARGIN);
      if (active && dt > 0) {
        shop.elapsed += dt;
        if (shop.elapsed >= SHOP_LOOP_SECONDS) {
          shop.elapsed = 0;
          shop.index = (shop.index + 1) % shop.labels.length;
        }
        anyActive = true;
      }
      layoutShop(shop, vp, active);
    }

    if (anyActive) {
      engine.scheduler.requestContinuous(STREET_CONTINUOUS_REASON);
      engine.scheduler.requestFrame();
    } else {
      engine.scheduler.releaseContinuous(STREET_CONTINUOUS_REASON);
    }
  };

  const tick = (now: number): void => {
    raf = 0;
    if (disposed) return;
    if (!lastNow) lastNow = now;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    step(dt);
    if (!disposed) raf = requestAnimationFrame(tick);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stopTick();
    engine.scheduler.releaseContinuous(STREET_CONTINUOUS_REASON);
    for (const walker of walkers) walker.el?.remove();
    for (const shop of shops) shop.el?.remove();
  };

  step(0);
  if (autoTick && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);

  return { step, dispose, getState: snapshot };
}

function mountWalker(ui: HTMLElement | null | undefined, hue: string): HTMLElement | null {
  if (!ui || typeof document === "undefined") return null;
  const el = document.createElement("div");
  el.className = "qingming-walker";
  el.setAttribute("aria-hidden", "true");
  el.style.background = hue;
  ui.appendChild(el);
  return el;
}

function mountShop(ui: HTMLElement | null | undefined, label: string): HTMLElement | null {
  if (!ui || typeof document === "undefined") return null;
  const el = document.createElement("div");
  el.className = "qingming-shop";
  el.setAttribute("aria-hidden", "true");
  el.textContent = label;
  ui.appendChild(el);
  return el;
}
