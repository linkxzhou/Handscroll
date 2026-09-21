export interface TileLevel {
  id: string;
  scale: number;
}

export interface TileManifest {
  width: number;
  height: number;
  tileSize: number;
  format?: string;
  levels: TileLevel[];
  /** Template with {level}, {x}, {y}. */
  tileUrl: string;
}

export function parseManifest(raw: unknown): TileManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Tile manifest must be an object");
  }
  const m = raw as Record<string, unknown>;
  const width = Number(m.width);
  const height = Number(m.height);
  const tileSize = Number(m.tileSize);
  if (!Number.isFinite(width) || width <= 0) throw new Error("manifest.width must be a positive number");
  if (!Number.isFinite(height) || height <= 0) throw new Error("manifest.height must be a positive number");
  if (!Number.isFinite(tileSize) || tileSize <= 0) throw new Error("manifest.tileSize must be a positive number");
  if (!Array.isArray(m.levels) || m.levels.length === 0) throw new Error("manifest.levels must be a non-empty array");
  const levels: TileLevel[] = m.levels.map((level, i) => {
    if (!level || typeof level !== "object") throw new Error(`manifest.levels[${i}] invalid`);
    const l = level as Record<string, unknown>;
    const id = String(l.id ?? i);
    const scale = Number(l.scale);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`manifest.levels[${i}].scale must be positive`);
    return { id, scale };
  });
  levels.sort((a, b) => a.scale - b.scale);
  const tileUrl = typeof m.tileUrl === "string" ? m.tileUrl : "{level}/{x}_{y}.webp";
  return {
    width,
    height,
    tileSize,
    format: typeof m.format === "string" ? m.format : undefined,
    levels,
    tileUrl,
  };
}

export function tileUrl(manifest: TileManifest, levelId: string, x: number, y: number): string {
  return manifest.tileUrl
    .replaceAll("{level}", levelId)
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}
