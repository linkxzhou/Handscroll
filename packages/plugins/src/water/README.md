# Water plugin

Builtin river overlay. Decision: **lazy Three transparent planes** (path A) with a DOM shimmer fallback. See `plan/adr/0002-water-effect.md`.

## Enable

Add `"water"` to pack `meta.plugins` and configure world-space bands (painting coords, y down):

```json
{
  "plugins": ["quality", "guide", "water"],
  "pluginConfig": {
    "water": {
      "enabled": true,
      "bands": [{ "x": 0, "y": 520, "w": 6516, "h": 200 }]
    }
  }
}
```

Do **not** enable from a pack that has no bands — the plugin stays a quiet no-op (no stub `console.info`).

## Runtime

1. `engine.ensureThree()` loads `renderer-three` if the viewer mounted a lazy Three canvas.
2. Dynamic `import("@handscroll/renderer-three")` builds a translucent sine-wave plane per band.
3. If Three is missing (tests, `renderers.three: false`, WebGL failure), a CSS band is world-synced in the UI layer. That fallback is gated and titled in the DOM; it is not a production substitute for the shader.

Toggle: emit `water:set` with `{ enabled: boolean }`. Cleanup on `onSceneUnload` / `onDestroy`.
