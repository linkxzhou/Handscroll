/** Polyline follow. No boats, people, or painting names. */

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathDef {
  id: string;
  points: PathPoint[];
  closed?: boolean;
}

export type FollowMode = "once" | "loop" | "ping-pong";

export interface FollowerState {
  pathId: string;
  /** Arc length along the polyline. */
  distance: number;
  /** World pixels per second. */
  speed: number;
  mode: FollowMode;
  direction: 1 | -1;
  paused?: boolean;
}

export interface PathSample {
  x: number;
  y: number;
  direction: 1 | -1;
  /** True when mode is `once` and the follower is sitting on an endpoint. */
  finished: boolean;
}

export interface ScalarTrack {
  /** Distance uses the same arc-length units as the path. Values lerp between keys. */
  keys: { distance: number; value: number }[];
}

/**
 * Open polyline length. A `closed` path adds the return segment inside `stepFollower`,
 * not here, so callers can measure the authored point list.
 */
export function polylineLength(points: readonly PathPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

/**
 * Point at `distance` along the polyline.
 * Distances before the start clamp to the first point.
 * Distances past the end clamp to the last point.
 */
export function pointAlong(points: readonly PathPoint[], distance: number): PathPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y };
}

export function sampleTrack(keys: readonly { distance: number; value: number }[], distance: number): number {
  if (keys.length === 0) return 1;
  const first = keys[0]!;
  if (distance <= first.distance) return first.value;
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (distance <= b.distance) {
      const span = b.distance - a.distance;
      const t = span === 0 ? 0 : (distance - a.distance) / span;
      return a.value + (b.value - a.value) * t;
    }
  }
  return keys[keys.length - 1]!.value;
}

/**
 * Advance a follower by `dt` seconds.
 * Mutates `state.distance` and `state.direction` when the follower actually moves.
 * `dt === 0`, `paused`, or `speed === 0` leave the state unchanged.
 */
export function stepFollower(path: PathDef, state: FollowerState, dt: number): PathSample {
  const points = followPoints(path);
  const length = polylineLength(points);
  const direction = state.direction === -1 ? -1 : 1;

  if (state.paused || dt === 0 || state.speed === 0 || length === 0) {
    const pos = pointAlong(points, length === 0 ? 0 : state.distance);
    return {
      x: pos.x,
      y: pos.y,
      direction,
      finished: onceFinished(state.mode, direction, state.distance, length),
    };
  }

  if (state.mode === "loop") {
    const distance = wrap(state.distance + direction * state.speed * dt, length);
    state.distance = distance;
    state.direction = direction;
    const pos = pointAlong(points, distance);
    return { x: pos.x, y: pos.y, direction, finished: false };
  }

  if (state.mode === "ping-pong") {
    const next = stepPingPong(state.distance, direction, state.speed * dt, length);
    state.distance = next.distance;
    state.direction = next.direction;
    const pos = pointAlong(points, next.distance);
    return { x: pos.x, y: pos.y, direction: next.direction, finished: false };
  }

  let distance = state.distance + direction * state.speed * dt;
  let finished = false;
  if (direction >= 0 && distance >= length) {
    distance = length;
    finished = true;
  } else if (direction < 0 && distance <= 0) {
    distance = 0;
    finished = true;
  }
  state.distance = distance;
  state.direction = direction;
  const pos = pointAlong(points, distance);
  return { x: pos.x, y: pos.y, direction, finished };
}

function followPoints(path: PathDef): PathPoint[] {
  const points = path.points;
  if (!path.closed || points.length < 2) return points.slice();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.x === last.x && first.y === last.y) return points.slice();
  return [...points, { x: first.x, y: first.y }];
}

function onceFinished(mode: FollowMode, direction: 1 | -1, distance: number, length: number): boolean {
  if (mode !== "once") return false;
  if (length === 0) return true;
  return direction >= 0 ? distance >= length : distance <= 0;
}

function wrap(distance: number, length: number): number {
  if (length <= 0) return 0;
  const m = distance % length;
  return m < 0 ? m + length : m;
}

/**
 * Ping-pong is a triangular wave of period `2 * length`.
 * Phase 0..length faces +1; phase length..2length faces -1.
 */
function stepPingPong(
  distance: number,
  direction: 1 | -1,
  travel: number,
  length: number,
): { distance: number; direction: 1 | -1 } {
  const span = length * 2;
  let phase = direction === 1 ? distance : span - distance;
  phase += travel;
  phase = wrap(phase, span);
  if (phase <= length) return { distance: phase, direction: 1 };
  return { distance: span - phase, direction: -1 };
}
