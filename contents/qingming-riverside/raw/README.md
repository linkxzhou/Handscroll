# qingming-riverside raw assets

## Source
Derived from the open project [xianxie6/qingming-riverside](https://github.com/xianxie6/qingming-riverside) (vendored locally under `third_party/qingming-riverside`).

These are **original generated illustrations** for an interactive riverside scroll inspired by the *Qingming* genre — **not** scans of Zhang Zeduan’s Song-dynasty painting.

## Files
- `background.webp` — offline stitch of `district-west` + `street-empty` + `district-east` at 6516×724 (each panel 2172×724). Engine world coords use this plate; reference-code coordinates map via `x' = x_ref + 2172`.
- `overlays/boat.webp` — upstream boat plate (2172×724, mostly transparent). Story uses a crop at `atlas/boat.webp` (40,150,2100,425) scaled to ~213×64 world units.

## License
Confirm upstream repository license before public redistribution of binaries. Attribution required in `meta.json` / app about UI.

## Seam note
Stitch uses opaque panel paste + centered crossfade (no white canvas under alpha). Regenerate with `python3 tools/qingming-adapt/stitch-districts.py` then `pnpm content:tiles -- --id qingming-riverside`.
