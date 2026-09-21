# Dual-canvas renderer topology

- Status: accepted for v1 (Phase 0–E2)
- Date: 2026-09-21

## Context

Handscroll needs a 2D long-scroll renderer (tiles, sprites, HUD-adjacent world content) and an optional 3D path (water, models) without sharing a WebGL context.

## Decision

Default topology is **two stacked canvases** plus a DOM UI layer:

1. PixiJS canvas (`.pixi-layer`) — main 2D world, owns input hit-testing for tiles/sprites
2. Three.js canvas (`.three-layer`) — optional overlay, `pointer-events: none`
3. DOM `.ui-layer` — chapter rail and HTML panels

Input is bound on the viewer container, not on either canvas.

`renderers.three: "lazy"` mounts an empty Three canvas but does **not** import `three` until `ensureLoaded()` (model3d entity or a future water plugin).

`packages/core` never imports `pixi.js` or `three`. Adapters are injected into `ScrollEngine.create`.

## Consequences

- Simple occlusion: Three always draws on top of Pixi. Complex interleaving is out of scope; if a painting needs 2D over 3D over 2D, move that content onto a single renderer (see plan 01).
- Two GPU contexts cost more memory; quality plugin + cache budgets mitigate this.
- Coordinate sync: Pixi world root uses `scale = zoom`, `position = (sw/2 - centerX*zoom, sh/2 - centerY*zoom)`. Three ortho camera uses painting `(x, y) → (x, -y, z)` with `visibleW = sw/zoom`.
