import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export interface TileBuilderOptions {
  contentDir: string;
  tileSize?: number;
  quality?: number;
  levels?: number[];
}

export interface TileBuilderResult {
  width: number;
  height: number;
  tileSize: number;
  levels: { id: string; scale: number; cols: number; rows: number }[];
  outputDir: string;
  tileCount: number;
}

const BACKGROUND_NAMES = ["background.webp", "background.png", "background.jpg", "background.jpeg", "background.tif", "background.tiff"];

export async function findBackground(rawDir: string): Promise<string> {
  for (const name of BACKGROUND_NAMES) {
    const candidate = path.join(rawDir, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  const entries = await fs.readdir(rawDir).catch(() => []);
  const hit = entries.find((e) => /^background\./i.test(e));
  if (!hit) {
    throw new Error(`No background image in ${rawDir} (expected background.png|webp|jpg)`);
  }
  return path.join(rawDir, hit);
}

export async function buildTiles(options: TileBuilderOptions): Promise<TileBuilderResult> {
  const tileSize = options.tileSize ?? 512;
  const quality = options.quality ?? 82;
  const contentDir = path.resolve(options.contentDir);
  const rawDir = path.join(contentDir, "raw");
  const outputDir = path.join(contentDir, "tiles");
  const sourcePath = await findBackground(rawDir);

  const image = sharp(sourcePath, { limitInputPixels: false });
  const meta = await image.metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error(`Could not read dimensions from ${sourcePath}`);

  const scales = options.levels ?? defaultScales(width, height);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const levels: TileBuilderResult["levels"] = [];
  let tileCount = 0;

  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i]!;
    const id = String(i);
    const levelW = Math.max(1, Math.round(width * scale));
    const levelH = Math.max(1, Math.round(height * scale));
    const cols = Math.ceil(levelW / tileSize);
    const rows = Math.ceil(levelH / tileSize);
    const levelDir = path.join(outputDir, id);
    await fs.mkdir(levelDir, { recursive: true });

    const resized = await image
      .clone()
      .resize(levelW, levelH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buf = resized.data;
    const channels = resized.info.channels;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = col * tileSize;
        const top = row * tileSize;
        const tw = Math.min(tileSize, levelW - left);
        const th = Math.min(tileSize, levelH - top);
        const tile = Buffer.alloc(tw * th * 4);
        for (let y = 0; y < th; y++) {
          const srcStart = ((top + y) * levelW + left) * channels;
          const dstStart = y * tw * 4;
          if (channels === 4) {
            buf.copy(tile, dstStart, srcStart, srcStart + tw * 4);
          } else {
            for (let x = 0; x < tw; x++) {
              const si = srcStart + x * channels;
              const di = dstStart + x * 4;
              tile[di] = buf[si] ?? 0;
              tile[di + 1] = buf[si + 1] ?? 0;
              tile[di + 2] = buf[si + 2] ?? 0;
              tile[di + 3] = 255;
            }
          }
        }
        await sharp(tile, { raw: { width: tw, height: th, channels: 4 } })
          .webp({ quality })
          .toFile(path.join(levelDir, `${col}_${row}.webp`));
        tileCount += 1;
      }
    }

    levels.push({ id, scale, cols, rows });
  }

  const manifest = {
    width,
    height,
    tileSize,
    format: "webp",
    levels: levels.map((l) => ({ id: l.id, scale: l.scale })),
    tileUrl: "{level}/{x}_{y}.webp",
  };
  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const metaPath = path.join(contentDir, "meta.json");
  try {
    const packMeta = JSON.parse(await fs.readFile(metaPath, "utf8")) as { width?: number; height?: number };
    if (packMeta.width && packMeta.width !== width) {
      throw new Error(`meta.width (${packMeta.width}) does not match image width (${width})`);
    }
    if (packMeta.height && packMeta.height !== height) {
      throw new Error(`meta.height (${packMeta.height}) does not match image height (${height})`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      /* optional */
    } else if (err instanceof SyntaxError) {
      throw err;
    } else {
      throw err;
    }
  }

  return { width, height, tileSize, levels, outputDir, tileCount };
}

function defaultScales(width: number, height: number): number[] {
  const longest = Math.max(width, height);
  const scales: number[] = [];
  let scale = 1;
  while (longest * scale > 256) {
    scales.push(Number(scale.toFixed(6)));
    scale /= 2;
  }
  if (!scales.includes(1)) scales.unshift(1);
  if (scales.length === 0) scales.push(1);
  return [...new Set(scales)].sort((a, b) => a - b);
}
