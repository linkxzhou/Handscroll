import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentsRoot = path.join(repoRoot, "contents");

function attachContents(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use("/contents", (req, res, next) => {
    const rel = decodeURIComponent((req.url ?? "").split("?")[0] ?? "").replace(/^\/+/, "");
    const file = path.resolve(contentsRoot, rel);
    if (!file.startsWith(contentsRoot)) {
      res.statusCode = 403;
      res.end("forbidden");
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        next();
        return;
      }
      const ext = path.extname(file);
      const types: Record<string, string> = {
        ".json": "application/json",
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".md": "text/markdown; charset=utf-8",
      };
      res.setHeader("Content-Type", types[ext] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      fs.createReadStream(file).pipe(res);
    });
  });
}

function serveContents(): Plugin {
  return {
    name: "handscroll-contents",
    configureServer: attachContents,
    configurePreviewServer: attachContents,
  };
}

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  plugins: [serveContents()],
  server: {
    fs: { allow: [repoRoot] },
  },
  resolve: {
    alias: {
      "@handscroll/core": path.join(repoRoot, "packages/core/src/index.ts"),
      "@handscroll/scene": path.join(repoRoot, "packages/scene/src/index.ts"),
      "@handscroll/assets": path.join(repoRoot, "packages/assets/src/index.ts"),
      "@handscroll/tiles": path.join(repoRoot, "packages/tiles/src/index.ts"),
      "@handscroll/interaction": path.join(repoRoot, "packages/interaction/src/index.ts"),
      "@handscroll/animation": path.join(repoRoot, "packages/animation/src/index.ts"),
      "@handscroll/renderer-pixi": path.join(repoRoot, "packages/renderer-pixi/src/index.ts"),
      "@handscroll/renderer-three": path.join(repoRoot, "packages/renderer-three/src/index.ts"),
      "@handscroll/plugins": path.join(repoRoot, "packages/plugins/src/index.ts"),
    },
  },
});
