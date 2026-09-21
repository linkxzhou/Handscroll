# Content packs

Each painting is a folder under `contents/<scroll-id>/`. The engine never hard-codes a title.

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

Story code, if any, lives in `story/` and must export `registerStory`. This milestone still browses a pack with no story module.

See `plan/30-business-layer.md` for schemas and `plan/01-engine-implementation.md` for the workflow.
