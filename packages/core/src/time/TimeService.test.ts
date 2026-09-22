import { describe, expect, it } from "vitest";
import { EventBus } from "../EventBus.ts";
import { TimeService } from "./TimeService.ts";

describe("TimeService W-U-04", () => {
  it("does not accumulate speed while paused, then steps once on resume", () => {
    const events = new EventBus();
    const pauses: string[] = [];
    events.on("time:pause", () => pauses.push("pause"));
    events.on("time:resume", () => pauses.push("resume"));
    const time = new TimeService(events);

    time.setPaused(true);
    time.setPaused(true);
    expect(time.gameDt(2)).toBe(0);
    expect(time.gameDt(5)).toBe(0);
    expect(pauses).toEqual(["pause"]);

    time.setPaused(false);
    expect(time.gameDt(0.25)).toBeCloseTo(0.25);
    expect(pauses).toEqual(["pause", "resume"]);
  });

  it("scales only gameDt", () => {
    const time = new TimeService(new EventBus());
    time.setScale(2);
    expect(time.gameDt(0.1)).toBeCloseTo(0.2);
    time.setPaused(true);
    expect(time.gameDt(0.1)).toBe(0);
  });

  it("emits time:ofday only when the value changes", () => {
    const events = new EventBus();
    const seen: unknown[] = [];
    events.on("time:ofday", (value) => seen.push(value));
    const time = new TimeService(events);
    time.setTimeOfDay(0.25);
    time.setTimeOfDay(0.25);
    time.setTimeOfDay(null);
    expect(seen).toEqual([0.25, null]);
  });
});
