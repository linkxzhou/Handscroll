# Handscroll

Multi-scroll interactive long-painting engine. One runtime for every content pack; *Qingming* is just another folder under `contents/`.

**Architecture:** core viewport/input/tiles/scheduler → plugins (quality, guide, …) → business packs in `contents/<scroll-id>/`. PixiJS draws the 2D world; Three.js is a lazy overlay canvas that does not load until something actually needs 3D.

Package manager is **Yarn Berry 4** with `nodeLinker: node-modules` (a real `node_modules` tree so Vite / sharp / Pixi stay ordinary; Plug'n'Play is not used). Enable Corepack once on Node 22+, then `yarn install`.

## Commands

```bash
corepack enable          # once, if `yarn -v` is still 1.x
yarn install

# generate the synthetic demo painting + tile pyramid
yarn content:generate-demo

# or tile any pack after placing raw/background.png
yarn content:tiles --id demo-scroll

yarn content:validate --id demo-scroll
yarn typecheck
yarn test:unit
yarn test:dep          # core must not import pixi.js / three

yarn viewer            # public face — gallery home at http://localhost:5174/
                       # open a pack: http://localhost:5174/?scroll=qingming-riverside
yarn playground        # engine HUD sandbox — http://localhost:5173/?scroll=demo-scroll

# first real content pack (stitched riverside)
yarn content:tiles --id qingming-riverside   # if tiles/ is missing
yarn content:validate --id qingming-riverside
```

Drag to pan, wheel to zoom. No story script is required to browse tiles.

`qingming-riverside` is an **original generated** street scroll derived from [xianxie6/qingming-riverside](https://github.com/xianxie6/qingming-riverside). It is **not** a scan of Zhang Zeduan’s Song-dynasty *Along the River During the Qingming Festival*. See `contents/qingming-riverside/README.md`.

In that pack: click docks for the ferry; **过船** (bottom-left, or the pin on 虹桥) starts the Rainbow Bridge crossing. Escape cancels. **时雨 / 夜景 / 水面 / 音效** toggle atmosphere. Street-life silhouettes walk near 茶市 / 虹桥 / 城门.

## New content pack

```bash
yarn content:new --id my-scroll --title "My Scroll"
# place the long image at contents/my-scroll/raw/background.png
# write source/license in contents/my-scroll/raw/README.md
yarn content:tiles --id my-scroll
yarn content:scaffold-scene --id my-scroll
yarn content:validate --id my-scroll
```

The viewer home (`yarn viewer`, `/`) discovers `contents/*/meta.json` (skipping `_template`). A new published pack shows up as a card without editing the app.

v1 does **not** call an image-gen API. See `tools/image-gen/README.md`.

## Layout

```
packages/core            Engine, viewport, input, scheduler, plugin host
packages/{scene,assets,tiles,interaction,animation}
packages/renderer-pixi   2D adapter
packages/renderer-three  lazy 3D adapter
packages/plugins         quality, guide, audio/weather/water stubs
apps/playground          engine HUD sandbox
apps/viewer              gallery home `/` + `/?scroll=<id>` reader
tools/tile-builder       sharp CLI
tools/scene-validator    Zod + cross checks
contents/_template
contents/demo-scroll
contents/qingming-riverside   # riverside street pack (tiles + story)
```

Plans in `plan/` are the source of truth. This milestone is Phase 0 + engine E0–E2: you can put an image in `raw/`, tile it, and pan/zoom in the playground.
