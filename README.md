# Handscroll

Multi-scroll interactive long-painting engine. One runtime for every content pack; a historical title is just another folder under `contents/`.

**Architecture:** core viewport/input/tiles/scheduler → plugins (quality, guide, …) → business packs in `contents/<scroll-id>/`. PixiJS draws the 2D world; Three.js is a lazy overlay canvas that does **not** load until a scene has a `model3d` entity or a three-backed plugin (currently `water`) is enabled.

## Commands

```bash
pnpm install

# generate synthetic paintings + tile pyramids for demo-scroll and guide-only-scroll
pnpm content:generate-demo

# or tile any pack after placing raw/background.png
pnpm content:tiles -- --id demo-scroll

pnpm content:validate -- --id demo-scroll
pnpm content:validate -- --id guide-only-scroll
pnpm content:validate:all
pnpm typecheck
pnpm test:unit
pnpm test:dep          # core must not import pixi.js / three

pnpm playground        # http://localhost:5173/?scroll=demo-scroll
pnpm viewer            # http://localhost:5174/?scroll=demo-scroll
# second pack:
#   http://localhost:5173/?scroll=guide-only-scroll
```

Drag to pan, wheel to zoom. Chapter dots fly the camera. Hotspots with `openPanel` show a commentary card. A pack does not need a story module to browse tiles.

## Story modules

Each pack may export `registerStory(engine)` from `story/index.ts` (override with `meta.storyEntry`). The playground and viewer **Vite-glob** those modules and inject them through `ContentResolver.loadStory` — the engine never fetches TypeScript over HTTP.

```ts
export function registerStory(engine: ScrollEnginePublic): () => void {
  const off = engine.on("entity:click", (hit) => {
    if (hit.entityId !== "gate-plaque") return;
    engine.camera.flyTo({ centerX: 1760, centerY: 310, zoom: 1.05, duration: 700 });
  });
  engine.on("scene:unload", off);
  return off;
}
```

- `demo-scroll` — click the city-gate hotspot to fly in; the guide plugin opens the panel from the hotspot action.
- `guide-only-scroll` — weak/empty story; chapters + commentary hotspots only.
- Switching packs emits `scene:unload`, runs the story cleanup, destroys plugins, and clears tiles / 3D anchors.

Stories must not import other `contents/` packs or `packages/renderer-*` internals.

## Three overlay

The Three adapter mounts a pointer-events-none canvas immediately, but the `three` chunk is loaded only from `ensureLoaded()`. The engine calls that when `sceneNeedsThree(scene, meta.plugins)` is true (`model3d` entities or plugin id `water`).

World mapping is `(x, y) → (x, -y, z)`. A `model3d` with `url: "primitive:box"` (demo pack, on the bridge) becomes a box aligned to that pose. 2D-only packs such as `guide-only-scroll` never pull the chunk.

Water remains a registry stub until ADR 0002.

## Tests

```bash
pnpm test:unit          # Vitest — viewport, tiles/LOD, PluginHost, stories, pack switch, lazy Three
pnpm test:engine        # subset: core / tiles / assets / interaction
pnpm test:plugins
pnpm test:content       # scene Zod + scene-validator
pnpm test:dep           # packages/core must not import pixi.js or three
pnpm typecheck
```

`pnpm test:unit` is the gate: every test file must pass (no skips used as a way to hide failures).

**Playwright / browser e2e is not wired.** Agents and CI here have no installed Playwright browser project, and WebGL/headed Chrome was flaky (GPU + process EIO) even when system Chrome was present. Pan/zoom, story register/unregister, pack isolation, and lazy Three are covered by Vitest (happy-dom + stub renderers) instead.

## New content pack

```bash
pnpm content:new -- --id my-scroll --title "My Scroll"
# place the long image at contents/my-scroll/raw/background.png
# write source/license in contents/my-scroll/raw/README.md
pnpm content:tiles -- --id my-scroll
pnpm content:scaffold-scene -- --id my-scroll
pnpm content:validate -- --id my-scroll
```

Add the id to `BUNDLED_SCROLL_IDS` in `packages/scene` if it should appear in the playground/viewer picker. v1 does **not** call an image-gen API. See `tools/image-gen/README.md`.

## Layout

```
packages/core            Engine, viewport, input, scheduler, plugin host, story contract
packages/{scene,assets,tiles,interaction,animation}
packages/renderer-pixi   2D adapter
packages/renderer-three  lazy 3D adapter (ortho sync + model3d boxes)
packages/plugins         quality, guide (+ commentary panel), audio/weather/water stubs
apps/playground          HUD, pack switcher, ?scroll=
apps/viewer              ?scroll= loader
tools/tile-builder       sharp CLI + synthetic pack generator
tools/scene-validator    Zod + cross checks
contents/_template
contents/demo-scroll     tiles + story (gate click → flyTo) + model3d box
contents/guide-only-scroll  different size; chapters + commentary; empty story
```

Plans in `plan/` are the source of truth. This branch covers Phase 0 + E0–E2 plus story loading, a second pack, and a lazy Three `model3d` path.

Still deferred: full ferry/bridge event machines, water ADR visuals, Playwright full suite, image-gen API.
