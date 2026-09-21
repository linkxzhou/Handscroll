import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildTiles } from "./build.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contentDir = path.join(repoRoot, "contents", "demo-scroll");
const rawDir = path.join(contentDir, "raw");

const WIDTH = 4096;
const HEIGHT = 1024;

function svg(): string {
  const bands = [
    ["#c4784a", "Dawn market"],
    ["#d4a05a", "Canal and boats"],
    ["#7a9e6a", "Willows"],
    ["#6b8cae", "City gate"],
    ["#b85c4a", "Bridge"],
    ["#8b6914", "Temple roofs"],
    ["#5c7a6a", "Workshops"],
    ["#4a6b8a", "River dusk"],
  ];
  const bandW = WIDTH / bands.length;
  const rects = bands
    .map(([color, label], i) => {
      const x = i * bandW;
      return `
        <rect x="${x}" y="0" width="${bandW}" height="${HEIGHT}" fill="${color}"/>
        <rect x="${x + 24}" y="80" width="${bandW - 48}" height="160" fill="rgba(255,255,255,0.18)" rx="12"/>
        <text x="${x + bandW / 2}" y="170" text-anchor="middle" font-size="48" font-family="serif" fill="#1b140f">${label}</text>
        <text x="${x + bandW / 2}" y="${HEIGHT - 60}" text-anchor="middle" font-size="28" font-family="serif" fill="rgba(27,20,15,0.7)">col ${i + 1}</text>
      `;
    })
    .join("");
  const grid = Array.from({ length: 16 }, (_, i) => {
    const x = (i + 1) * (WIDTH / 16);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="rgba(27,20,15,0.12)" stroke-width="2"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${rects}
  ${grid}
  <text x="${WIDTH / 2}" y="48" text-anchor="middle" font-size="32" font-family="serif" fill="#1b140f">Handscroll demo-scroll · synthetic long painting</text>
</svg>`;
}

await fs.mkdir(rawDir, { recursive: true });
const outPng = path.join(rawDir, "background.png");
await sharp(Buffer.from(svg())).png().toFile(outPng);
console.log(`Wrote ${outPng} (${WIDTH}×${HEIGHT})`);
const result = await buildTiles({ contentDir, tileSize: 512 });
console.log(`Demo tiles: ${result.tileCount} files`);
