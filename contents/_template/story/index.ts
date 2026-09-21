import type { ScrollEngine } from "@handscroll/core";

/** Optional. The engine still browses tiles if this module is missing. */
export async function registerStory(_engine: ScrollEngine): Promise<void> {
  // Content-specific hooks go here. Do not import other content packs.
}
