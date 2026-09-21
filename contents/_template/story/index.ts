import type { ScrollEnginePublic } from "@handscroll/core";

/** Optional. The engine still browses tiles if this module is missing. */
export async function registerStory(_engine: ScrollEnginePublic): Promise<void> {
  // Content-specific hooks go here. Do not import other content packs.
}
