# 沿河街市（清明上河图式）

Handscroll content pack `qingming-riverside`. First real painting pack: stitch, chapters, hotspots, a simplified ferry, **虹桥过船**, atmosphere (时雨 / 夜景 / 水面), and a modest street-life overlay.

## Open

```bash
yarn viewer
# gallery: http://localhost:5174/
# this pack: http://localhost:5174/?scroll=qingming-riverside

yarn playground
# engine HUD: http://localhost:5173/?scroll=qingming-riverside
```

Drag to pan, wheel to zoom. Bottom dots fly to 水磨 / 茶市 / 虹桥 / 城门. Click a pin or hotspot for a short panel. Click 西岸/东岸码头 to run the ferry.

### 虹桥过船

Start the simplified crossing (content-pack story, not core):

1. Click the bottom-left **过船** button, or
2. Click the **过船** pin / hotspot `bridge-event` on the Rainbow Bridge, or
3. Open the **虹桥** panel and press **开始过船**

The cargo boat (same `atlas/boat.webp` as the ferry) approaches from downstream, lowers its mast, then passes the arch. Hold **牵绳** (or Left Arrow / E) to help; spectating still completes the path. **Escape** cancels and removes overlays.

**Faked occlusion:** Handscroll tiles are a single layer, so the hull is not clipped through the painted arch. While the boat is under the bridge, a DOM strip (`.qingming-bridge-occluder`) sits above the sprite. This is a stand-in for upstream Canvas2D arch masking — not 1:1 with `qingming-riverside` `bridge-art.js`.

### 时雨 / 夜景 / 水面

Left-bottom pills sit above **过船** (same HUD language as ferry/bridge):

| 按钮 | 行为 |
|---|---|
| **时雨** | `weather:set` → `rain` / `clear`. First-pass visual is a CSS rain sheet from the `weather` plugin (not a particle sim). |
| **夜景** | Pack-local **multiply color wash** over the viewport. **Not** a second night tile set. Approximation only. |
| **水面** | Toggles the `water` plugin. Primary path is a **lazy Three** translucent river plane (ADR 0002). If Three/WebGL is missing, a titled DOM shimmer band is the gated fallback. |
| **音效** | Unmutes the `audio` plugin (`defaultMuted: true`). Rain/water cues are **procedural WebAudio noise**, not bundled mp3. |

Leaving the pack (viewer **目录**, or loading `demo-scroll`) disposes HUD, night wash, walkers, weather overlay, and water meshes — same hygiene as ferry/bridge.

If `tiles/` is missing locally:

```bash
yarn content:tiles --id qingming-riverside
yarn content:validate --id qingming-riverside
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
| water band | river AABB | y 520–724, full width |
| street paths | pedestrians | 茶市 / 虹桥 / 城门 pavement |

## Versus upstream

Playable subset of the reference state machine (approach → mast/haul → under arch → done/cancel). Not ported: Canvas2D runtime, crowd reactions, painter “record” stills, drag-force crash-avoidance, or exact 90s+ timing.

### Night (faked)

Upstream night could swap lighting on the full scene. This pack uses a **multiply/color wash overlay** only. Tiles stay the daylight stitch. Lamp-by-lamp lighting and dual tile sets are omitted.

### Water

See `plan/adr/0002-water-effect.md`. Chosen path **A**: lazy Three overlay (`ensureLoaded` / `ensureThree`), not a Pixi filter. The river band is a translucent sine-wave plane. It is **not** the upstream `water-three.js` port (no refraction mesh, no per-pixel river mask). DOM fallback exists for headless/no-WebGL and is documented on the element title.

### Crowds / street-life

Eight CSS silhouette walkers on three polylines (茶市, 虹桥, 城门) plus three looping shop labels. **Viewport active zone** (~viewport + 320wu) updates motion; farther figures idle or cull. Not ported: 141 mesh-deformed people, clothing dye cache, full shop dialogue, atlas pedestrians from `people-ink.webp`.

### Audio gap

No upstream/unlicensed mp3 is copied into this pack. Ambient rain/water is optional filtered noise through the `audio` plugin, muted until **音效**.

## Out of scope (still deferred)

- Dual night tile sets / per-lamp lighting
- Full `water-three.js` refraction and river mask
- 141-person street sim and people atlas
- Exact 1:1 parity with the upstream minigame feel
- `third_party/` (gitignored; do not commit)
