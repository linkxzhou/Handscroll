import type { EngineContext, PluginFactory, ScrollPlugin, VesselSummonCommand } from "@handscroll/core";

export interface VesselSummon extends VesselSummonCommand {}

export function parseSummon(payload: unknown): VesselSummon | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.actorId !== "string" || record.actorId.length === 0) return null;
  const command: VesselSummon = { actorId: record.actorId };
  if (typeof record.pathId === "string") command.pathId = record.pathId;
  if (typeof record.fromDistance === "number" && Number.isFinite(record.fromDistance)) command.fromDistance = record.fromDistance;
  if (typeof record.toDistance === "number" && Number.isFinite(record.toDistance)) command.toDistance = record.toDistance;
  if (typeof record.speed === "number" && Number.isFinite(record.speed)) command.speed = record.speed;
  if (record.quiet === true) command.quiet = true;
  return command;
}

export function parseActorId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { actorId?: unknown }).actorId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Listens for summon / pause / resume and reports a single arrival per trip.
 * The plugin does not read paths itself; the world simulator steps them.
 */
export const createVesselPlugin: PluginFactory = (): ScrollPlugin => {
  let ctx: EngineContext | null = null;
  const offs: Array<() => void> = [];

  return {
    id: "vessel",
    priority: 8,
    onRegister(next) {
      ctx = next;
      const world = next.world;
      offs.push(
        next.engine.events.on("vessel:summon", (payload) => {
          const command = parseSummon(payload);
          if (!command || !world) return;
          if (world.summon(command)) next.engine.scheduler.requestFrame();
        }),
      );
      offs.push(
        next.engine.events.on("vessel:pause", (payload) => {
          const actorId = parseActorId(payload);
          if (!actorId || !world) return;
          world.pauseActor(actorId);
        }),
      );
      offs.push(
        next.engine.events.on("vessel:resume", (payload) => {
          const actorId = parseActorId(payload);
          if (!actorId || !world) return;
          world.resumeActor(actorId);
          next.engine.scheduler.requestFrame();
        }),
      );
    },
    onFrame() {
      const world = ctx?.world;
      if (!world) return;
      for (const arrival of world.drainArrivals()) {
        ctx?.engine.events.emit("vessel:arrived", arrival);
      }
    },
    onDestroy() {
      for (const off of offs) off();
      offs.length = 0;
      ctx = null;
    },
  };
};
