import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildTiles } from "./build.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

interface Band {
  color: string;
  label: string;
}

interface PackSpec {
  id: string;
  width: number;
  height: number;
  title: string;
  bands: Band[];
}

const PACKS: PackSpec[] = [
  {
    id: "demo-scroll",
    width: 4096,
    height: 1024,
    title: "Handscroll demo-scroll · synthetic long painting",
    bands: [
      { color: "#c4784a", label: "Dawn market" },
      { color: "#d4a05a", label: "Canal and boats" },
      { color: "#7a9e6a", label: "Willows" },
      { color: "#6b8cae", label: "City gate" },
      { color: "#b85c4a", label: "Bridge" },
      { color: "#8b6914", label: "Temple roofs" },
      { color: "#5c7a6a", label: "Workshops" },
      { color: "#4a6b8a", label: "River dusk" },
    ],
  },
  {
    id: "guide-only-scroll",
    width: 3072,
    height: 768,
    title: "Handscroll guide-only-scroll · commentary pack",
    bands: [
      { color: "#3d5a6c", label: "West grove" },
      { color: "#4f7a6e", label: "Reed marsh" },
      { color: "#6a8aa0", label: "Canal path" },
      { color: "#8b7355", label: "Stone walk" },
      { color: "#5a4e72", label: "East terrace" },
      { color: "#2f4a58", label: "Night water" },
    ],
  },
];

function svgFor(spec: PackSpec): string {
  const bandW = spec.width / spec.bands.length;
  const rects = spec.bands
    .map((band, i) => {
      const x = i * bandW;
      return `
        <rect x="${x}" y="0" width="${bandW}" height="${spec.height}" fill="${band.color}"/>
        <rect x="${x + 24}" y="64" width="${bandW - 48}" height="140" fill="rgba(255,255,255,0.16)" rx="12"/>
        <text x="${x + bandW / 2}" y="148" text-anchor="middle" font-size="40" font-family="serif" fill="#f4efe6">${band.label}</text>
        <text x="${x + bandW / 2}" y="${spec.height - 48}" text-anchor="middle" font-size="24" font-family="serif" fill="rgba(244,239,230,0.7)">col ${i + 1}</text>
      `;
    })
    .join("");
  const cols = spec.bands.length * 2;
  const grid = Array.from({ length: cols }, (_, i) => {
    const x = (i + 1) * (spec.width / cols);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${spec.height}" stroke="rgba(244,239,230,0.1)" stroke-width="2"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
  ${rects}
  ${grid}
  <text x="${spec.width / 2}" y="36" text-anchor="middle" font-size="28" font-family="serif" fill="#f4efe6">${spec.title}</text>
</svg>`;
}

async function generatePack(spec: PackSpec): Promise<void> {
  const contentDir = path.join(repoRoot, "contents", spec.id);
  const rawDir = path.join(contentDir, "raw");
  await fs.mkdir(rawDir, { recursive: true });
  const outPng = path.join(rawDir, "background.png");
  await sharp(Buffer.from(svgFor(spec))).png().toFile(outPng);
  console.log(`Wrote ${outPng} (${spec.width}×${spec.height})`);
  const result = await buildTiles({ contentDir, tileSize: 512 });
  console.log(`${spec.id} tiles: ${result.tileCount} files`);
}

for (const spec of PACKS) {
  await generatePack(spec);
}
