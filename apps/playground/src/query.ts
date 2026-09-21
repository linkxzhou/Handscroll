import type { QualityLevel } from "@handscroll/core";

export function parseScrollId(search: string): string {
  const params = new URLSearchParams(search);
  return params.get("scroll") || "demo-scroll";
}

export function isQuality(value: string): value is QualityLevel {
  return value === "auto" || value === "low" || value === "medium" || value === "high";
}

export function formatViewportHud(vp: { zoom: number; centerX: number; centerY: number }): string {
  return `z ${vp.zoom.toFixed(2)} · (${vp.centerX.toFixed(0)}, ${vp.centerY.toFixed(0)})`;
}
