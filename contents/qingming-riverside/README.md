# 沿河街市（清明上河图式）

Handscroll content pack `qingming-riverside`. First real painting pack: stitch, chapters, hotspots, and a simplified ferry.

## Open

```bash
pnpm playground
# http://localhost:5173/?scroll=qingming-riverside

pnpm viewer
# http://localhost:5174/?scroll=qingming-riverside
```

Drag to pan, wheel to zoom. Bottom dots fly to 水磨 / 茶市 / 虹桥 / 城门. Click a pin or hotspot for a short panel. Click 西岸/东岸码头 to run the ferry.

If `tiles/` is missing locally:

```bash
pnpm content:tiles -- --id qingming-riverside
pnpm content:validate -- --id qingming-riverside
```

## Attribution

Artwork is derived from **[xianxie6/qingming-riverside](https://github.com/xianxie6/qingming-riverside)** — original generated illustrations for an interactive riverside scroll.

**This is not a scan of Zhang Zeduan’s Song-dynasty *Along the River During the Qingming Festival*.** Do not present it as the historical painting.

See `raw/README.md` and `meta.json` `license`. Confirm the upstream license before redistributing binaries.

## World coordinates

Stitched plate is **6516×724** (`west | center | east`, each 2172×724).

Reference-runtime coordinates map with `x' = x_ref + 2172`, `y' = y_ref` (`story/coords.ts`). Chapter and hotspot numbers were remapped from upstream `data-x` / `spots` / `berths`, then framed on this stitch.

| id | role | engine x (approx.) |
|---|---|---|
| watermill | chapter | 622 |
| teahouse | chapter | 2822 |
| bridge | chapter | 3732 |
| gate | chapter | 5532 |
| dock-west / dock-east | ferry | 2802 / 4257 (berths) |

## Out of scope (this pack version)

- Rainbow-bridge rope minigame
- Weather / night / Three water
- Crowd / street-life port
- `third_party/` (gitignored; do not commit)
