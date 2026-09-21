import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTiles } from "./build.ts";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const prefixed = process.argv.find((a) => a.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  return fallback;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const id = arg("--content") ?? arg("--id");
if (!id) {
  console.error("Usage: pnpm content:tiles -- --id demo-scroll");
  process.exit(1);
}

const contentDir = path.join(repoRoot, "contents", id);
const tileSize = Number(arg("--tile-size") ?? 512);

try {
  const result = await buildTiles({ contentDir, tileSize });
  console.log(
    `Tiled ${id}: ${result.width}×${result.height}, ${result.tileCount} tiles, levels ${result.levels.map((l) => l.scale).join(", ")} → ${result.outputDir}`,
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
