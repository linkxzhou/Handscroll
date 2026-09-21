import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "tools/**/*.test.ts",
    ],
    environment: "node",
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@handscroll/core": path.resolve("packages/core/src/index.ts"),
      "@handscroll/scene": path.resolve("packages/scene/src/index.ts"),
      "@handscroll/assets": path.resolve("packages/assets/src/index.ts"),
      "@handscroll/tiles": path.resolve("packages/tiles/src/index.ts"),
      "@handscroll/interaction": path.resolve("packages/interaction/src/index.ts"),
      "@handscroll/animation": path.resolve("packages/animation/src/index.ts"),
      "@handscroll/renderer-pixi": path.resolve("packages/renderer-pixi/src/index.ts"),
      "@handscroll/renderer-three": path.resolve("packages/renderer-three/src/index.ts"),
      "@handscroll/plugins": path.resolve("packages/plugins/src/index.ts"),
    },
  },
});
