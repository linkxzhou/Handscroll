import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembleGalleryPacks,
  loadPublishedPacksFromGlob,
  packIdFromMetaPath,
  scrollHref,
  type PackMetaLite,
} from "./packs.ts";

const contentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../contents");

function metasFromDisk(): Array<{ path: string; meta: PackMetaLite }> {
  return fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const metaPath = path.join(contentsDir, entry.name, "meta.json");
      if (!fs.existsSync(metaPath)) return [];
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as PackMetaLite;
      return [{ path: `contents/${entry.name}/meta.json`, meta }];
    });
}

describe("viewer gallery pack registry", () => {
  it("skips _template and unknown files when parsing meta paths", () => {
    expect(packIdFromMetaPath("contents/_template/meta.json")).toBeNull();
    expect(packIdFromMetaPath("/abs/contents/qingming-riverside/meta.json")).toBe("qingming-riverside");
    expect(packIdFromMetaPath("not-a-pack.json")).toBeNull();
  });

  it("lists published packs with qingming first and demo secondary", () => {
    const packs = assembleGalleryPacks(metasFromDisk(), new Set(["qingming-riverside"]));
    expect(packs.map((p) => p.id)).toEqual(["qingming-riverside", "path-walker", "demo-scroll"]);
    expect(packs[0]?.featured).toBe(true);
    expect(packs[0]?.title).toBe("沿河街市（清明上河图式）");
    expect(packs[0]?.coverUrl).toBe("/contents/qingming-riverside/preview/cover.webp");
    expect(packs[0]?.href).toBe("/?scroll=qingming-riverside");
    const demo = packs.find((pack) => pack.id === "demo-scroll");
    expect(demo?.secondary).toBe(true);
    expect(demo?.featured).toBe(false);
    const fixture = packs.find((pack) => pack.id === "path-walker");
    expect(fixture?.featured).toBe(false);
    expect(fixture?.secondary).toBe(false);
  });

  it("builds deep links and skips templates from a Vite-style glob", () => {
    const packs = loadPublishedPacksFromGlob(
      {
        "../../../contents/_template/meta.json": { id: "untitled-scroll", title: "Untitled" },
        "../../../contents/demo-scroll/meta.json": { default: { id: "demo-scroll", title: "Demo scroll" } },
        "../../../contents/qingming-riverside/meta.json": {
          id: "qingming-riverside",
          title: "沿河街市（清明上河图式）",
        },
      },
      { "../../../contents/qingming-riverside/preview/cover.webp": "/hashed/cover.webp" },
    );
    expect(packs.map((p) => p.id)).toEqual(["qingming-riverside", "demo-scroll"]);
    expect(scrollHref("qingming-riverside")).toBe("/?scroll=qingming-riverside");
  });
});
