import { polylineLength } from "@handscroll/animation";
import scene from "../scene.json";

export interface PathPoint {
  x: number;
  y: number;
}

export function scenePath(id: string): PathPoint[] {
  const found = scene.paths.find((path) => path.id === id);
  return found ? found.points.map((point) => ({ x: point.x, y: point.y })) : [];
}

export function scenePathLength(id: string): number {
  return polylineLength(scenePath(id));
}

/** Arc length at each vertex, starting at 0. */
export function sceneStations(id: string): number[] {
  const points = scenePath(id);
  const stations = [0];
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    stations.push(acc);
  }
  return stations;
}
