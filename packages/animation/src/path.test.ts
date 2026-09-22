import { describe, expect, it } from "vitest";
import { pointAlong, polylineLength, sampleTrack, stepFollower, type FollowerState, type PathDef } from "./path.ts";

const segment: PathDef = {
  id: "lane",
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

function state(partial: Partial<FollowerState> = {}): FollowerState {
  return {
    pathId: "lane",
    distance: 0,
    speed: 100,
    mode: "once",
    direction: 1,
    ...partial,
  };
}

describe("path follower W-U-01", () => {
  it("clamps pointAlong past the ends", () => {
    const points = segment.points;
    expect(polylineLength(points)).toBe(100);
    expect(pointAlong(points, -20)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(points, 40)).toEqual({ x: 40, y: 0 });
    expect(pointAlong(points, 1000)).toEqual({ x: 100, y: 0 });
  });

  it("loops by arc length and keeps direction", () => {
    const follower = state({ mode: "loop", distance: 90, speed: 20 });
    const sample = stepFollower(segment, follower, 1);
    expect(sample.finished).toBe(false);
    expect(sample.direction).toBe(1);
    expect(sample.x).toBeCloseTo(10);
    expect(sample.y).toBe(0);
    expect(follower.distance).toBeCloseTo(10);
    expect(follower.direction).toBe(1);
  });

  it("ping-pongs when travel passes the end, including a bounce through zero", () => {
    const forward = state({ mode: "ping-pong", distance: 80, speed: 50 });
    const overshot = stepFollower(segment, forward, 1);
    expect(overshot.finished).toBe(false);
    expect(overshot.direction).toBe(-1);
    expect(overshot.x).toBeCloseTo(70);
    expect(forward.direction).toBe(-1);
    expect(forward.distance).toBeCloseTo(70);

    const backward = state({ mode: "ping-pong", distance: 10, direction: -1, speed: 30 });
    const bounced = stepFollower(segment, backward, 1);
    expect(bounced.direction).toBe(1);
    expect(bounced.x).toBeCloseTo(20);
    expect(backward.distance).toBeCloseTo(20);
  });

  it("stops once at the endpoint and does not accumulate further travel", () => {
    const follower = state({ mode: "once", speed: 80 });
    const arrived = stepFollower(segment, follower, 2);
    expect(arrived.finished).toBe(true);
    expect(arrived.x).toBe(100);
    expect(follower.distance).toBe(100);

    const held = stepFollower(segment, follower, 5);
    expect(held.finished).toBe(true);
    expect(held.x).toBe(100);
    expect(follower.distance).toBe(100);
  });

  it("leaves distance unchanged when dt is 0 or the follower is paused", () => {
    const paused = state({ mode: "loop", distance: 25, speed: 100, paused: true });
    const sample = stepFollower(segment, paused, 1);
    expect(sample.x).toBe(25);
    expect(paused.distance).toBe(25);

    const idle = state({ mode: "ping-pong", distance: 25, speed: 100 });
    const still = stepFollower(segment, idle, 0);
    expect(still.x).toBe(25);
    expect(still.finished).toBe(false);
    expect(idle.distance).toBe(25);
    expect(idle.direction).toBe(1);
  });

  it("closes a loop by returning along the first point", () => {
    const square: PathDef = {
      id: "square",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    const follower = state({ mode: "loop", pathId: "square", distance: 30, speed: 5 });
    const sample = stepFollower(square, follower, 1);
    expect(polylineLength(square.points)).toBe(30);
    expect(sample.x).toBeCloseTo(0);
    expect(sample.y).toBeCloseTo(5);
  });

  it("lerps a scalar track by arc length", () => {
    expect(sampleTrack([{ distance: 0, value: 1 }, { distance: 10, value: 0 }], 2.5)).toBeCloseTo(0.75);
  });
});
