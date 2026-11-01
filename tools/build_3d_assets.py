"""
Builds textures for the WebGL hero (src/sections/Hero/three) from the approved, transparent
artwork in home_screen_design/:

  4.png   pumpkin                                   -> pumpkin.webp
  3.png   main ghost with hat, lantern, star, moon  -> ghost.webp
  1.png   small ghost (used twice, one mirrored)    -> ghost-small.webp
  2.png   branches + leaf pile with a candle        -> foliage.webp, candle.webp, leaf-*.webp

For every character it also writes
  *-depth.png   inflation height map (distance from the silhouette edge) — gives the flat
                artwork real volume when the camera moves
  *-glow.png    emissive mask (carved face, lantern, moon, flame) — only these bloom
and manifest.json with sizes and the anchor points (UVs) the scene needs.

No pixels are redrawn. Run:  python tools/build_3d_assets.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "home_screen_design"
OUT = ROOT / "src" / "assets" / "hero3d"

# ---- source geometry (pixels in the original PNGs) -----------------------------------------

PUMPKIN = {
    "file": "4.png",
    "glow_boxes": [(470, 530, 1010, 890)],
    "flame": (722, 815),           # the candle inside, seen through the mouth
    "body_x": (252, 1092),
}

GHOST = {
    "file": "3.png",
    "glow_boxes": [
        (250, 450, 465, 835),      # lantern
        (985, 225, 1125, 360),     # moon
        (290, 265, 410, 395),      # star
    ],
    "still": (240, 450, 475, 845),  # lantern: excluded from the fabric ripple
    "hem_x": (305, 1035),
    "hem_top_y": 800,
    "lantern": (360, 720),
}

SMALL_GHOST = {"file": "1.png"}

FOLIAGE = {"file": "2.png", "candle_box": (918, 556, 1048, 818)}
CANDLE = {
    "body": (924, 676, 1044, 816),
    "flame": (956, 556, 1020, 690),
    "flame_glow": (958, 556, 1018, 668),   # flame only — stops above the bright wax rim
}

LEAVES = {  # single leaves in 2.png
    "leaf-1": (515, 138, 618, 248),
    "leaf-2": (1092, 198, 1248, 358),
    "leaf-3": (22, 402, 178, 588),
    "leaf-4": (1282, 642, 1482, 828),
}


# ---- helpers ------------------------------------------------------------------------------

def load(name):
    im = cv2.imread(str(SRC / name), cv2.IMREAD_UNCHANGED)
    return im[..., :3].astype(np.float32), im[..., 3].astype(np.float32) / 255


def save_rgba(path, bgr, alpha):
    rgba = np.dstack([np.clip(bgr, 0, 255).astype(np.uint8), np.clip(alpha * 255, 0, 255).astype(np.uint8)])
    cv2.imwrite(str(path), rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])


def save_gray(path, m, size=None):
    m = np.clip(m * 255, 0, 255).astype(np.uint8)
    if size:
        m = cv2.resize(m, size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(path), m)


def bbox(alpha, pad=6):
    ys, xs = np.nonzero(alpha > 0.02)
    h, w = alpha.shape
    return max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, w), min(ys.max() + pad + 1, h)


def largest(m):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return m
    return np.where(labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)


def depth_map(alpha, power=0.55, smooth=0.035):
    d = cv2.distanceTransform((alpha > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    d = (d / max(d.max(), 1)) ** power
    return cv2.GaussianBlur(d, (0, 0), smooth * max(alpha.shape)) * (alpha > 0.02)


def glow_map(bgr, alpha, boxes, v0=0.78, s0=0.3):
    hsv = cv2.cvtColor(np.clip(bgr, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32) / 255
    g = np.clip((hsv[..., 2] - v0) / 0.2, 0, 1) * np.clip((hsv[..., 1] - s0) / 0.25, 0, 1)
    region = np.zeros_like(g)
    for x0, y0, x1, y1 in boxes:
        region[y0:y1, x0:x1] = 1
    return cv2.GaussianBlur(g * cv2.GaussianBlur(region, (0, 0), 6) * alpha, (0, 0), 1.5)


def to_uv(pt, box):
    x0, y0, x1, y1 = box
    return [round(float(pt[0] - x0) / (x1 - x0), 4), round(1 - float(pt[1] - y0) / (y1 - y0), 4)]


def rect_uv(r, box):
    a, b = to_uv((r[0], r[3]), box), to_uv((r[2], r[1]), box)
    return [a[0], a[1], b[0], b[1]]  # minU, minV, maxU, maxV


def export(name, bgr, alpha, glow=None, depth=(0.55, 0.035)):
    box = bbox(alpha)
    x0, y0, x1, y1 = box
    c, a = bgr[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    save_rgba(OUT / f"{name}.webp", c, a)
    w, h = x1 - x0, y1 - y0
    save_gray(OUT / f"{name}-depth.png", depth_map(a, *depth), (max(64, w // 3), max(64, h // 3)))
    g = glow[y0:y1, x0:x1] if glow is not None else np.zeros_like(a)
    save_gray(OUT / f"{name}-glow.png", g, (max(16, w // 2), max(16, h // 2)))
    print(f"{name}: {w}x{h}")
    return box, [int(w), int(h)]


def smoke_texture(size=256, seed=7):
    """Soft noise puff used by the drifting floor smoke (drei <Clouds>)."""
    rng = np.random.default_rng(seed)
    noise = np.zeros((size, size), np.float32)
    for octave in range(5):
        n = 4 * 2 ** octave
        layer = cv2.resize(rng.random((n, n)).astype(np.float32), (size, size), interpolation=cv2.INTER_CUBIC)
        noise += layer / 2 ** octave
    noise = (noise - noise.min()) / (noise.max() - noise.min())
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size - 0.5
    blob = np.clip(1 - np.sqrt(xx ** 2 + yy ** 2) / 0.5, 0, 1) ** 1.6
    a = np.clip(blob * (0.35 + 0.9 * noise) - 0.05, 0, 1)
    rgba = np.dstack([np.full((size, size, 3), 255, np.uint8), (a * 255).astype(np.uint8)])
    cv2.imwrite(str(OUT / "smoke.png"), rgba)


# ---- assets -------------------------------------------------------------------------------

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*"):
        old.unlink()
    m = {}

    bgr, a = load(PUMPKIN["file"])
    # low saturation floor: the near-white hotspot of the inner candle is light too
    box, size = export("pumpkin", bgr, a, glow_map(bgr, a, PUMPKIN["glow_boxes"], v0=0.74, s0=0.0))
    ys = np.nonzero(a.max(1) > 0.5)[0]
    bx0, bx1 = PUMPKIN["body_x"]
    m["pumpkin"] = {
        "size": size,
        "bodyWidth": bx1 - bx0,
        "base": to_uv(((bx0 + bx1) / 2, ys.max()), box),
        "flame": to_uv(PUMPKIN["flame"], box),
    }

    bgr, a = load(GHOST["file"])
    box, size = export("ghost", bgr, a, glow_map(bgr, a, GHOST["glow_boxes"], v0=0.7))
    hx0, hx1 = GHOST["hem_x"]
    ys = np.nonzero(a.max(1) > 0.5)[0]
    m["ghost"] = {
        "size": size,
        "hemWidth": hx1 - hx0,
        "hemTop": to_uv((0, GHOST["hem_top_y"]), box)[1],
        "hemBottom": to_uv((0, ys.max()), box)[1],
        "hemCenter": to_uv(((hx0 + hx1) / 2, 0), box)[0],
        "still": rect_uv(GHOST["still"], box),
        "lantern": to_uv(GHOST["lantern"], box),
    }

    bgr, a = load(SMALL_GHOST["file"])
    box, size = export("ghost-small", bgr, a, depth=(0.6, 0.05))
    m["ghost-small"] = {"size": size}

    # foliage: branches + leaf pile (its candle ends up hidden behind the pumpkin)
    bgr, a = load(FOLIAGE["file"])
    box, size = export("foliage", bgr, a, depth=(0.5, 0.02))
    ys = np.nonzero(a.max(1) > 0.5)[0]
    m["foliage"] = {"size": size, "base": to_uv((0, ys.max()), box)[1]}

    # candle: the wax body + flame cut from the arrangement, base fading into the leaves
    cx0, cy0, cx1, cy1 = FOLIAGE["candle_box"]
    keep = np.zeros_like(a)
    for r in (CANDLE["body"], CANDLE["flame"]):
        keep[r[1]:r[3], r[0]:r[2]] = 1
    hsv = cv2.cvtColor(np.clip(bgr, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32) / 255
    wax = (hsv[..., 2] > 0.45).astype(np.float32)
    ca = a * keep * wax
    ca = largest((ca > 0.4).astype(np.uint8) * 255).astype(np.float32) / 255 * ca
    yy = np.arange(a.shape[0], dtype=np.float32)[:, None]
    ca *= np.clip((CANDLE["body"][3] - yy) / 14, 0, 1)
    ca = cv2.GaussianBlur(ca, (0, 0), 0.7)
    fx0, fy0, fx1, fy1 = CANDLE["flame_glow"]
    flame = np.zeros_like(a)
    flame[fy0:fy1, fx0:fx1] = np.clip((hsv[fy0:fy1, fx0:fx1, 2] - 0.7) / 0.2, 0, 1)
    flame *= ca
    sub = (slice(cy0, cy1), slice(cx0, cx1))
    box, size = export("candle", bgr[sub], ca[sub], cv2.GaussianBlur(flame, (0, 0), 1.2)[sub], depth=(0.5, 0.05))
    fy, fx = np.nonzero(flame[sub] > 0.5)
    m["candle"] = {"size": size, "flame": to_uv((fx.mean() + 0.0, fy.mean() + 0.0), box) if len(fx) else [0.5, 0.85]}

    for name, (x0, y0, x1, y1) in LEAVES.items():
        la = a[y0:y1, x0:x1]
        keep_leaf = largest((la > 0.5).astype(np.uint8) * 255)
        la = la * (cv2.dilate(keep_leaf, np.ones((3, 3), np.uint8)) > 0)
        _, size = export(name, bgr[y0:y1, x0:x1], la, depth=(0.5, 0.05))
        m[name] = {"size": size}

    smoke_texture()
    (OUT / "manifest.json").write_text(json.dumps(m, indent=2))
    print("wrote manifest.json")


if __name__ == "__main__":
    main()
