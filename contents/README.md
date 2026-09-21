# Content packs

Each painting is a folder under `contents/<scroll-id>/`. The engine never hard-codes a title.

## New scroll

```bash
yarn content:new --id my-scroll --title "My Scroll"
# put a long image at contents/my-scroll/raw/background.png
# document source in contents/my-scroll/raw/README.md
yarn content:tiles --id my-scroll
yarn content:scaffold-scene --id my-scroll   # if you need a fresh scene.json
yarn content:validate --id my-scroll
yarn viewer
# gallery lists the pack; open ?scroll=my-scroll
```

`raw/` is hand-placed only (v1 has no image-gen API). `tiles/` is tool output — do not edit by hand.

Story code, if any, lives in `story/` and must export `registerStory`. This milestone still browses a pack with no story module.

Shipped packs:

- `qingming-riverside` — stitched riverside street with ferry, 虹桥过船, 时雨/夜景/水面, and a modest street-life overlay; `yarn viewer` → `/?scroll=qingming-riverside`
- `demo-scroll` — synthetic engine-acceptance painting (tech demo card on the gallery)

See `plan/30-business-layer.md` for schemas and `plan/01-engine-implementation.md` for the workflow.
