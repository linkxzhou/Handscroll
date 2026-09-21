# 沿河街市（清明上河图式）

Handscroll content pack `qingming-riverside`. First real painting pack: stitch, chapters, hotspots, a simplified ferry, and **虹桥过船**.

## Open

```bash
pnpm playground
# http://localhost:5173/?scroll=qingming-riverside

pnpm viewer
# http://localhost:5174/?scroll=qingming-riverside
```

Drag to pan, wheel to zoom. Bottom dots fly to 水磨 / 茶市 / 虹桥 / 城门. Click a pin or hotspot for a short panel. Click 西岸/东岸码头 to run the ferry.

### 虹桥过船

Start the simplified crossing (content-pack story, not core):

1. Click the bottom-left **过船** button, or
2. Click the **过船** pin / hotspot `bridge-event` on the Rainbow Bridge, or
3. Open the **虹桥** panel and press **开始过船**

The cargo boat (same `atlas/boat.webp` as the ferry) approaches from downstream, lowers its mast, then passes the arch. Hold **牵绳** (or Left Arrow / E) to help; spectating still completes the path. **Escape** cancels and removes overlays.

**Faked occlusion:** Handscroll tiles are a single layer, so the hull is not clipped through the painted arch. While the boat is under the bridge, a DOM strip (`.qingming-bridge-occluder`) sits above the sprite. This is a stand-in for upstream Canvas2D arch masking — not 1:1 with `qingming-riverside` `bridge-art.js`.

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
| bridge-event | 过船 hotspot | 3660 |

## Versus upstream `bridge-event`

Playable subset of the reference state machine (approach → mast/haul → under arch → done/cancel). Not ported: Canvas2D runtime, crowd reactions, painter “record” stills, drag-force crash-avoidance, or exact 90s+ timing.

## Out of scope (Phase E / F, still deferred)

- Weather / night / Three water (ADR)
- Crowd / street-life port
- Exact 1:1 parity with the upstream minigame feel
- `third_party/` (gitignored; do not commit)
