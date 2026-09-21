# Content packs

Each painting is a folder under `contents/<scroll-id>/`. The engine never hard-codes a title.

Bundled CI packs:

| Pack | Role |
|---|---|
| `demo-scroll` | Tiles + guide + story (`gate-plaque` click → `camera.flyTo`) + a `model3d` primitive box |
| `guide-only-scroll` | Different size; chapters + commentary hotspots; empty story; no Three |

Preview: `?scroll=demo-scroll` or `?scroll=guide-only-scroll` on playground or viewer.

## New scroll

```bash
pnpm content:new -- --id my-scroll --title "My Scroll"
# put a long image at contents/my-scroll/raw/background.png
# document source in contents/my-scroll/raw/README.md
pnpm content:tiles -- --id my-scroll
pnpm content:scaffold-scene -- --id my-scroll   # if you need a fresh scene.json
pnpm content:validate -- --id my-scroll
pnpm playground
# open ?scroll=my-scroll
```

`raw/` is hand-placed only (v1 has no image-gen API). `tiles/` is tool output — do not edit by hand.

Story code lives in `story/index.ts` and must export `registerStory`. Return a cleanup function and/or listen for `scene:unload`. The viewer loads stories via Vite `import.meta.glob`, not by fetching `.ts` from `/contents`.

See `plan/30-business-layer.md` for schemas and `plan/01-engine-implementation.md` for the workflow.
