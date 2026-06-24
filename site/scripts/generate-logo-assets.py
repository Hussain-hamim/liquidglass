#!/usr/bin/env python3
"""Generate transparent logo + favicon assets from site/logo.png."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "logo.png"
OUT = ROOT / "public"
BG_TOL = 28
ICON_HEIGHT_RATIO = 0.58


def color_dist(c1: np.ndarray, c2: np.ndarray) -> float:
    return float(np.sqrt(np.sum((c1.astype(float) - c2.astype(float)) ** 2)))


def remove_background(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    bg = np.median(
        arr[
            [0, 0, h - 1, h - 1, w - 1, w - 1, 0, h - 1],
            [0, w - 1, 0, w - 1, 0, w - 1, w - 1, 0],
            :3,
        ],
        axis=0,
    )

    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    for y in range(h):
        for x in range(w):
            if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                if color_dist(arr[y, x, :3], bg) <= BG_TOL:
                    visited[y, x] = True
                    bg_mask[y, x] = True
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                if color_dist(arr[ny, nx, :3], bg) <= BG_TOL:
                    visited[ny, nx] = True
                    bg_mask[ny, nx] = True
                    q.append((nx, ny))

    out = arr.copy()
    out[bg_mask, 3] = 0
    return out


def crop_icon(out: np.ndarray) -> Image.Image:
    h, w = out.shape[:2]
    icon_bottom = int(h * ICON_HEIGHT_RATIO)
    region = out[:icon_bottom]
    ys, xs = np.where(region[:, :, 3] > 20)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    pad = int((x1 - x0) * 0.08)
    x0 = max(0, x0 - pad)
    x1 = min(w - 1, x1 + pad)
    y0 = max(0, y0 - pad)
    y1 = min(icon_bottom, y1 + pad)

    icon = Image.fromarray(out[y0 : y1 + 1, x0 : x1 + 1])
    iw, ih = icon.size
    side = max(iw, ih)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(icon, ((side - iw) // 2, (side - ih) // 2))
    return square


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source logo: {SRC}")

    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    src.save(OUT / "logo.png")

    out = remove_background(np.array(src))
    Image.fromarray(out).save(OUT / "logo-transparent.png")

    icon = crop_icon(out)
    icon.save(OUT / "logo-icon.png")
    icon.resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "favicon.png")
    icon.resize((180, 180), Image.Resampling.LANCZOS).save(OUT / "apple-touch-icon.png")

    for size in (16, 48, 512):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f"favicon-{size}.png")

    print(f"Wrote assets to {OUT}")


if __name__ == "__main__":
    main()
