import type { ContentResolver, StoryModule } from "@handscroll/core";

export type StoryLoader = (scrollId: string, entry: string) => Promise<StoryModule | null>;

/** Bundled CI packs. Apps use this for `?scroll=` pickers; adding a pack means adding a folder plus this id. */
export const BUNDLED_SCROLL_IDS = ["demo-scroll", "guide-only-scroll"] as const;
export type BundledScrollId = (typeof BUNDLED_SCROLL_IDS)[number];

/** Turn a Vite glob key into `scrollId/story/index.ts`. */
export function storyPathFromGlobKey(key: string): string | null {
  const normalized = key.replace(/\\/g, "/");
  const marker = "/contents/";
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length);
  const prefixed = normalized.match(/(?:^|\/)contents\/(.+)$/);
  return prefixed?.[1] ?? null;
}

export function createGlobStoryLoader(modules: Record<string, () => Promise<unknown>>): StoryLoader {
  const map = new Map<string, () => Promise<unknown>>();
  for (const [key, load] of Object.entries(modules)) {
    const rel = storyPathFromGlobKey(key);
    if (rel) map.set(rel, load);
  }
  return async (scrollId, entry) => {
    const rel = `${scrollId}/${entry.replace(/^\.\//, "")}`;
    const load = map.get(rel);
    if (!load) return null;
    return (await load()) as StoryModule;
  };
}

export function withStoryLoader(resolver: ContentResolver, loadStory: StoryLoader): ContentResolver {
  return { ...resolver, loadStory };
}
