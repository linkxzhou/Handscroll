import { describe, expect, it } from "vitest";
import { createGlobStoryLoader, storyPathFromGlobKey, withStoryLoader } from "./storyLoader.ts";
import { createFetchResolver } from "./loadScene.ts";

describe("story loader", () => {
  it("normalizes Vite glob keys to pack-relative paths", () => {
    expect(storyPathFromGlobKey("../../../contents/demo-scroll/story/index.ts")).toBe("demo-scroll/story/index.ts");
    expect(storyPathFromGlobKey("/abs/contents/guide-only-scroll/story/index.ts")).toBe(
      "guide-only-scroll/story/index.ts",
    );
  });

  it("loads a matching story module and returns null when missing", async () => {
    let hits = 0;
    const loader = createGlobStoryLoader({
      "../../../contents/demo-scroll/story/index.ts": async () => {
        hits += 1;
        return { registerStory() {} };
      },
    });
    const demo = await loader("demo-scroll", "./story/index.ts");
    expect(demo?.registerStory).toBeTypeOf("function");
    expect(hits).toBe(1);
    expect(await loader("guide-only-scroll", "./story/index.ts")).toBeNull();
  });

  it("wraps a fetch resolver without replacing JSON loaders", async () => {
    const inner = createFetchResolver({ baseUrl: "/contents" });
    const wrapped = withStoryLoader(inner, async () => ({ registerStory() {} }));
    expect(wrapped.resolveUrl("demo-scroll", "./tiles/")).toBe("/contents/demo-scroll/tiles/");
    const story = await wrapped.loadStory?.("demo-scroll", "./story/index.ts");
    expect(story?.registerStory).toBeTypeOf("function");
  });
});
