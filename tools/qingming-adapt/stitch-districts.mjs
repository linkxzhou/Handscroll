#!/usr/bin/env node
/**
 * Stitch upstream district panels into contents/qingming-riverside/raw/background.webp
 * Requires: sharp (devDep) OR run the Python one-shot in plan/40.
 * Prefer: node with sharp if available in monorepo.
 */
import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "../..");
const assets = path.join(repo, "third_party/qingming-riverside/assets");
const outDir = path.join(repo, "contents/qingming-riverside/raw");

const W = 2172;
const H = 724;

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp not installed. Use: pnpm add -Dw sharp");
    console.error("Or regenerate via the Python stitch documented in plan/40.");
    process.exit(1);
  }
  for (const f of ["district-west.webp", "street-empty.webp", "district-east.webp"]) {
    await access(path.join(assets, f));
  }
  await mkdir(outDir, { recursive: true });
  const [west, center, east] = await Promise.all(
    ["district-west.webp", "street-empty.webp", "district-east.webp"].map((f) =>
      sharp(path.join(assets, f)).resize(W, H).ensureAlpha().png().toBuffer(),
    ),
  );
  await sharp({
    create: { width: W * 3, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: west, left: 0, top: 0 },
      { input: center, left: W, top: 0 },
      { input: east, left: W * 2, top: 0 },
    ])
    .webp({ quality: 82 })
    .toFile(path.join(outDir, "background.webp"));
  console.log("wrote", path.join(outDir, "background.webp"), `${W * 3}x${H}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
