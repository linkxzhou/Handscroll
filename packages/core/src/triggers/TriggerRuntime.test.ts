import { describe, expect, it } from "vitest";
import { EventBus } from "../EventBus.ts";
import type { ZoneDef } from "../contracts/world.ts";
import { TriggerRuntime, type TriggerSample } from "./TriggerRuntime.ts";

const zone: ZoneDef = {
  id: "gate",
  x: 0,
  y: 0,
  shape: { kind: "rect", w: 10, h: 10 },
};

function sample(x: number, y: number, actor?: { x: number; y: number }): TriggerSample {
  return {
    cameraX: x,
    cameraY: y,
    zones: [zone],
    actorPosition() {
      return actor ?? null;
    },
  };
}

describe("triggers W-U-05", () => {
  it("emits zone enter only on a crossing, and once suppresses later crossings", () => {
    const events = new EventBus();
    const hits: unknown[] = [];
    events.on("quest:start", (payload) => hits.push(payload));
    const runtime = new TriggerRuntime(events);
    runtime.load([
      {
        id: "enter-gate",
        when: { type: "zone:enter", zoneId: "gate", subject: "camera" },
        emit: "quest:start",
        payload: { id: "enter-gate" },
      },
    ]);

    runtime.update(sample(40, 40));
    runtime.update(sample(30, 30));
    expect(hits).toEqual([]);

    runtime.update(sample(5, 5));
    runtime.update(sample(6, 6));
    expect(hits).toEqual([{ id: "enter-gate" }]);

    runtime.update(sample(40, 40));
    runtime.update(sample(4, 4));
    expect(hits).toHaveLength(2);

    runtime.load([
      {
        id: "enter-once",
        when: { type: "zone:enter", zoneId: "gate", subject: "camera" },
        emit: "quest:start",
        once: true,
      },
    ]);
    hits.length = 0;
    runtime.update(sample(40, 40));
    runtime.update(sample(5, 5));
    runtime.update(sample(40, 40));
    runtime.update(sample(5, 5));
    expect(hits).toHaveLength(1);
  });

  it("clears once when the pack resets", () => {
    const events = new EventBus();
    let count = 0;
    events.on("quest:start", () => {
      count += 1;
    });
    const runtime = new TriggerRuntime(events);
    const trigger = {
      id: "enter-once",
      when: { type: "zone:enter" as const, zoneId: "gate", subject: "camera" as const },
      emit: "quest:start",
      once: true,
    };
    runtime.load([trigger]);
    runtime.update(sample(40, 40));
    runtime.update(sample(5, 5));
    runtime.reset();
    runtime.load([trigger]);
    runtime.update(sample(40, 40));
    runtime.update(sample(5, 5));
    expect(count).toBe(2);
  });

  it("maps entity clicks and chapter arrivals without replacing those bus events", () => {
    const events = new EventBus();
    const emitted: string[] = [];
    events.on("entity:click", () => emitted.push("entity"));
    events.on("chapter:arrive", () => emitted.push("arrive"));
    events.on("vessel:summon", () => emitted.push("summon"));
    events.on("chapter:open", () => emitted.push("open"));
    const runtime = new TriggerRuntime(events);
    events.on("entity:click", (payload) => runtime.onEntityClick(payload));
    events.on("chapter:arrive", (payload) => runtime.onChapterArrive(payload));
    runtime.load([
      { id: "dock", when: { type: "entity:click", entityId: "dock-east" }, emit: "vessel:summon", once: true },
      { id: "ch", when: { type: "chapter:enter", chapterId: "gate" }, emit: "chapter:open" },
    ]);

    events.emit("entity:click", { entityId: "dock-east" });
    events.emit("entity:click", { entityId: "dock-east" });
    events.emit("entity:click", { entityId: "other" });
    events.emit("chapter:arrive", { id: "gate" });
    events.emit("chapter:arrive", { id: "other" });

    expect(emitted.filter((name) => name === "summon")).toHaveLength(1);
    expect(emitted.filter((name) => name === "open")).toEqual(["open"]);
    expect(emitted.filter((name) => name === "entity").length).toBe(3);
    expect(emitted.filter((name) => name === "arrive").length).toBe(2);
  });

  it("plays and stops audio from zone crossings", () => {
    const events = new EventBus();
    const plays: unknown[] = [];
    const stops: unknown[] = [];
    events.on("audio:play", (payload) => plays.push(payload));
    events.on("audio:stop", (payload) => stops.push(payload));
    const runtime = new TriggerRuntime(events);
    runtime.load([
      {
        id: "rain-in",
        when: { type: "zone:enter", zoneId: "gate", subject: "camera" },
        emit: "audio:play",
        payload: { id: "rain", kind: "rain" },
      },
      {
        id: "rain-out",
        when: { type: "zone:exit", zoneId: "gate", subject: "camera" },
        emit: "audio:stop",
        payload: { id: "rain" },
      },
    ]);
    runtime.update(sample(40, 40));
    runtime.update(sample(5, 5));
    expect(plays).toEqual([{ id: "rain", kind: "rain" }]);
    runtime.update(sample(40, 40));
    expect(stops).toEqual([{ id: "rain" }]);
  });

  it("does not open a chapter when the flight was interrupted", () => {
    const events = new EventBus();
    const opened: string[] = [];
    events.on("chapter:open", () => opened.push("open"));
    const runtime = new TriggerRuntime(events);
    runtime.load([{ id: "ch", when: { type: "chapter:enter", chapterId: "gate" }, emit: "chapter:open" }]);
    runtime.onChapterArrive({ id: "gate", completed: false });
    expect(opened).toEqual([]);
    runtime.onChapterArrive({ id: "gate", completed: true });
    expect(opened).toEqual(["open"]);
  });
});
