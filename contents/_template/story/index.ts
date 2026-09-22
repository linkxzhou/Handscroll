import type { ScrollEngine } from "@handscroll/core";

/** Optional. The engine still browses tiles if this module is missing. */
export async function registerStory(engine: ScrollEngine): Promise<() => void> {
  // Listen for trigger.emit names. Do not create DOM nodes that follow the viewport.
  const off = engine.on("quest:start", () => {});
  return () => off();
}
