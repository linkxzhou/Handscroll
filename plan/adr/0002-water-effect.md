# Water effect renderer path

- Status: accepted for Phase E
- Date: 2026-09-21
- Relates: [0001-renderer-topology.md](./0001-renderer-topology.md), [20-plugin-layer.md](../20-plugin-layer.md) §4.5

## Context

Qingming-riverside (and later river scrolls) need a visible water treatment on the river band. Two candidates were recorded in the plugin plan:

- **A.** Lazy Three.js transparent overlay on the existing `.three-layer` (depends on `renderer-three`, loaded via `ensureLoaded()`)
- **B.** PixiJS filter / custom shader on the 2D world root

`packages/core` must not import `pixi.js` or `three`. The water plugin is a builtin opted in per pack via `meta.plugins`.

## Decision

**Choose A — lazy Three overlay**, with a **DOM shimmer fallback** when the Three host is absent (unit tests, `renderers.three: false`, or `ensureLoaded` failure).

Packs may list `"water"` in `meta.plugins` once this ADR is in tree. Configure world-space bands in `pluginConfig.water.bands` (no painting-specific coordinates in the plugin). Qingming-riverside enables the plugin; `demo-scroll` does not.

## Rationale

1. **ADR 0001 already reserved the Three canvas** for water and `model3d`. `ensureLoaded()` exists specifically so a future water plugin can pull `three` without a second WebGL context or a Pixi shader stack.
2. **Plugin contracts do not expose the Pixi world root.** Path B would either leak Pixi types into plugins or punch a new hole through core. Path A only needs a narrow `ensureThree()` + overlay attach/detach on `RendererAdapter`.
3. **Upstream `water-three.js` was a Three overlay.** Reusing that topology (not the Canvas2D runtime) keeps the dual-canvas composite rule simple: Three draws on top of tiles; DOM story overlays (ferry, 虹桥过船, pedestrians) stay above both.
4. **River band is the lower strip of the stitch** (`y ≈ 520–724` on qingming). A translucent plane there does not cover street-level hotspots. Hulls that must sit above water are already DOM (`qingming-boat` / cargo), not Pixi sprites.

Path B remains available later if a painting needs 2D-over-3D-over-2D interleaving; that is out of scope for v1 (see ADR 0001 consequences).

## Implementation notes

- `ScrollEnginePublic.ensureThree()` calls the lazy adapter’s `ensureLoaded()` and returns a `ThreeOverlayHost` (`attach` / `detach` of opaque `THREE.Object3D`s). Returns `null` when no Three adapter is mounted.
- `@handscroll/renderer-three` owns the shader plane factory (`createWaterEffect`). The water plugin **dynamically** imports that module after `ensureThree()` succeeds so quality/guide/audio do not pull `three`.
- Animation: `uTime` on a low-frequency sine mix; `scheduler.requestContinuous("water")` while enabled.
- Fallback: world-synced DOM band (`.hs-water-fallback`) with a CSS gradient animation. Gated, documented, used when Three is unavailable — still a visible effect, not a `console.info` stub.
- Disable: `water:set` `{ enabled: false }` detaches meshes / removes DOM; pack switch `onSceneUnload` / `onDestroy` must leave zero leftover nodes.
- Do **not** log stub `console.info` on register.

## Consequences

- Enabling water on a pack starts a second GPU context the first time `ensureThree()` runs (same cost as `model3d`).
- Three always composites above Pixi. Painted boats that remain Pixi sprites may sit under the water plane; prefer DOM/story overlays for vessels on the river.
- Coordinate drift must stay within a few world units of the configured band AABB (ortho camera uses `(x, y) → (x, -y, z)`).
- No licensed water/rain mp3 is bundled; ambient cues are optional procedural WebAudio through the `audio` plugin (`defaultMuted: true`).
