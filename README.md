# Handscroll

Multi-scroll interactive long-painting engine. One runtime for every content pack; *Qingming* is just another folder under `contents/`.

**Architecture:** core viewport/input/tiles/scheduler → plugins (quality, guide, …) → business packs in `contents/<scroll-id>/`. PixiJS draws the 2D world; Three.js is a lazy overlay canvas that does not load until something actually needs 3D.

## Commands

```bash
pnpm install

# generate the synthetic demo painting + tile pyramid
pnpm content:generate-demo

# or tile any pack after placing raw/background.png
pnpm content:tiles -- --id demo-scroll

pnpm content:validate -- --id demo-scroll
pnpm typecheck
pnpm test:unit
pnpm test:dep          # core must not import pixi.js / three

pnpm playground        # http://localhost:5173/?scroll=demo-scroll
pnpm viewer            # http://localhost:5174/?scroll=demo-scroll
```

Drag to pan, wheel to zoom. No story script is required to browse tiles.

## New content pack

```bash
pnpm content:new -- --id my-scroll --title "My Scroll"
# place the long image at contents/my-scroll/raw/background.png
# write source/license in contents/my-scroll/raw/README.md
pnpm content:tiles -- --id my-scroll
pnpm content:scaffold-scene -- --id my-scroll
pnpm content:validate -- --id my-scroll
```

v1 does **not** call an image-gen API. See `tools/image-gen/README.md`.

## Layout

```
packages/core            Engine, viewport, input, scheduler, plugin host
packages/{scene,assets,tiles,interaction,animation}
packages/renderer-pixi   2D adapter
packages/renderer-three  lazy 3D adapter
packages/plugins         quality, guide, audio/weather/water stubs
apps/playground          engine HUD
apps/viewer              ?scroll= loader
tools/tile-builder       sharp CLI
tools/scene-validator    Zod + cross checks
contents/_template
contents/demo-scroll
```

Plans in `plan/` are the source of truth. This milestone is Phase 0 + engine E0–E2: you can put an image in `raw/`, tile it, and pan/zoom in the playground.
