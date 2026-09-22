import type { EventBusLike, SchedulerLike } from "@handscroll/core";
import { scenePathLength } from "../paths.ts";

export type BerthId = "west" | "east";
export type FerryMode = "idle" | "crossing";

export const FERRY_ACTOR_ID = "ferry";
export const FERRY_PATH_ID = "ferry-lane";
export const CROSSING_SECONDS = 4;

export interface FerryPlan {
  destination: BerthId;
  fromDistance: number;
  toDistance: number;
  speed: number;
}

export interface FerrySnapshot {
  mode: FerryMode;
  berth: BerthId;
  destination: BerthId;
  disposed: boolean;
}

export interface FerryEngine {
  events: EventBusLike;
  scheduler: SchedulerLike;
}

export interface FerryController {
  summon(entityId: string): boolean;
  request(berth: BerthId): boolean;
  dispose(): void;
  getState(): FerrySnapshot;
}

export function oppositeBerth(berth: BerthId): BerthId {
  return berth === "east" ? "west" : "east";
}

export function dockIdToBerth(entityId: string): BerthId | null {
  const id = entityId.toLowerCase();
  if (!id.startsWith("dock-")) return null;
  if (id.includes("west")) return "west";
  if (id.includes("east")) return "east";
  return null;
}

export function berthDistance(berth: BerthId, length: number): number {
  return berth === "west" ? 0 : length;
}

/** Pack rule: a click on the current berth sends the hull to the other shore. */
export function planCrossing(berth: BerthId, clicked: BerthId, length: number): FerryPlan {
  const destination = clicked === berth ? oppositeBerth(clicked) : clicked;
  const span = Math.max(1, length);
  return {
    destination,
    fromDistance: berthDistance(berth, span),
    toDistance: berthDistance(destination, span),
    speed: span / CROSSING_SECONDS,
  };
}

export function createFerryController(engine: FerryEngine): FerryController {
  const length = scenePathLength(FERRY_PATH_ID);
  let mode: FerryMode = "idle";
  let berth: BerthId = "east";
  let destination: BerthId = "east";
  let disposed = false;
  const offs: Array<() => void> = [];

  const snapshot = (): FerrySnapshot => ({ mode, berth, destination, disposed });

  const request = (clicked: BerthId): boolean => {
    if (disposed || mode === "crossing") return false;
    const plan = planCrossing(berth, clicked, length);
    destination = plan.destination;
    mode = "crossing";
    engine.events.emit("vessel:summon", {
      actorId: FERRY_ACTOR_ID,
      pathId: FERRY_PATH_ID,
      fromDistance: plan.fromDistance,
      toDistance: plan.toDistance,
      speed: plan.speed,
    });
    engine.scheduler.requestFrame();
    return true;
  };

  const summon = (entityId: string): boolean => {
    const clicked = dockIdToBerth(entityId);
    if (!clicked) return false;
    return request(clicked);
  };

  offs.push(
    engine.events.on("dock:request", (payload) => {
      const berthId = readBerth(payload);
      if (berthId) request(berthId);
    }),
  );
  offs.push(
    engine.events.on("vessel:arrived", (payload) => {
      if (disposed || mode !== "crossing") return;
      if (!payload || typeof payload !== "object") return;
      if ((payload as { actorId?: unknown }).actorId !== FERRY_ACTOR_ID) return;
      berth = destination;
      mode = "idle";
    }),
  );

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mode = "idle";
    for (const off of offs) off();
    offs.length = 0;
  };

  return { summon, request, dispose, getState: snapshot };
}

function readBerth(payload: unknown): BerthId | null {
  if (!payload || typeof payload !== "object" || !("berth" in payload)) return null;
  const berth = (payload as { berth?: unknown }).berth;
  return berth === "west" || berth === "east" ? berth : null;
}
