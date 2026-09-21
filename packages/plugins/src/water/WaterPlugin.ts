import type { PluginFactory, ScrollPlugin } from "@handscroll/core";

/** Registry stub. Do not enable from meta until ADR 0002 is decided. */
export const createWaterPlugin: PluginFactory = (_raw): ScrollPlugin => ({
  id: "water",
  onRegister() {
    console.info("[handscroll] water plugin is a stub; see packages/plugins/src/water/README.md");
  },
});
