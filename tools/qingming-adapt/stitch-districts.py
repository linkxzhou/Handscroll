#!/usr/bin/env python3
"""Stitch west|center|east into contents/qingming-riverside/raw/background.webp without white seam bleed."""
from pathlib import Path
import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "third_party/qingming-riverside/assets"
OUT = REPO / "contents/qingming-riverside/raw"
W, H, FEATHER = 2172, 724, 48


def fit(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    return im if im.size == (W, H) else im.resize((W, H), Image.Resampling.LANCZOS)


def crossfade(arr: np.ndarray, left: Image.Image, right: Image.Image, seam: int, feather: int = FEATHER) -> None:
    half = feather // 2
    la, ra = np.array(left), np.array(right)
    for i in range(feather):
        x = seam - half + i
        if not (0 <= x < arr.shape[1]):
            continue
        t = (i + 0.5) / feather
        li, ri = x - (seam - W), x - seam
        if not (0 <= li < W and 0 <= ri < W):
            continue
        arr[:, x] = (1 - t) * la[:, li] + t * ra[:, ri]


def main() -> None:
    west = fit(Image.open(ASSETS / "district-west.webp"))
    center = fit(Image.open(ASSETS / "street-empty.webp"))
    east = fit(Image.open(ASSETS / "district-east.webp"))
    canvas = Image.new("RGB", (W * 3, H))
    canvas.paste(west, (0, 0))
    canvas.paste(center, (W, 0))
    canvas.paste(east, (W * 2, 0))
    arr = np.array(canvas, dtype=np.float32)
    crossfade(arr, west, center, W)
    crossfade(arr, center, east, W * 2)
    OUT.mkdir(parents=True, exist_ok=True)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    path = OUT / "background.webp"
    out.save(path, "WEBP", quality=85, method=6)
    print(f"wrote {path} {out.size}")


if __name__ == "__main__":
    main()
