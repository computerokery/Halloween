"""
Builds layered, high-resolution hero assets from the approved references in home_screen_design/.

Pipeline
  1. upscale  Real-ESRGAN x4 (realesrgan-x4plus) for crisp textures — run once, manually:
                realesrgan-ncnn-vulkan -n realesrgan-x4plus -i home_screen_design/1.jpg -o tools/.cache/1@4x.png
                realesrgan-ncnn-vulkan -n realesrgan-x4plus -i home_screen_design/3.jpg -o tools/.cache/3@4x.png
  2. clean    remove the UI text and divider that overlap the scene
  3. layers   cut the scene into independently animated layers (export ~2.25x of the reference):
                scene-back     background plate: foliage, branches, star, floor (ghosts removed)
                ghost-main     main ghost + witch hat + lantern + moon
                ghost-left/-right   small ghosts
                pumpkin        the complete jack-o'-lantern from 3.jpg (the design's pumpkin
                               top is hidden by the ghost), colour-matched, carved face unlit
                pumpkin-face   the lit carved face (lights up during the intro)
                leaf-1..4      falling leaves from 3.jpg
              plus layers.json — every layer's box as % of the scene plate.

No pixels are redrawn: layers are cut from the originals, edges are feathered, and pure
black is lifted to the page colour (#080706) so layers sit seamlessly on the page.

Run:  python tools/extract_assets.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "src" / "assets" / "hero"

UP = 4                # Real-ESRGAN factor
EXPORT = 2.25         # export scale relative to the 1280px reference (scene plate = 1620px wide)
BG = np.array([6, 7, 8], np.float32)  # #080706 in BGR

# ---- geometry, all in 1.jpg (1280 x 720) coordinates -----------------------------------

SCENE = (250, 54, 970, 720)

TEXT_BOXES = [
    (60, 188, 446, 260),    # MIDNIGHT
    (60, 260, 466, 340),    # IS CALLING
    (60, 360, 296, 398),    # tagline
    (940, 196, 1215, 266),  # right copy
    (940, 298, 1232, 362),  # buttons
]
DIVIDER_ROWS_4X = (2239, 2247)  # the 1px rule, as smeared by the upscaler

SMALL_GHOSTS = {
    "ghost-left": (368, 338, 488, 462),
    "ghost-right": (848, 424, 958, 542),
}

# Main ghost group (ghost, hat, lantern, moon) — generous outline, shrink-wrapped later.
MAIN_GHOST = [
    (505, 408), (494, 356), (496, 300), (538, 244), (553, 226), (549, 160), (551, 140),
    (590, 134), (645, 136), (660, 120), (684, 101), (704, 84), (730, 69), (770, 64),
    (820, 74), (861, 94), (897, 131), (892, 141), (872, 143), (897, 170), (882, 206),
    (845, 189), (836, 162), (814, 152), (802, 170), (814, 214), (824, 250), (822, 280),
    (812, 293), (817, 326), (839, 341), (845, 376), (840, 416), (846, 440), (845, 470),
    (836, 512), (800, 518), (770, 512), (740, 525), (560, 525), (538, 462), (527, 420),
    (536, 409),
]

# Witch-hat crown: dark, must never be eaten by the edge shrink-wrap or vignette
HAT_CROWN = [
    (585, 150), (640, 122), (690, 92), (720, 74), (750, 66), (800, 68), (845, 84),
    (878, 106), (896, 132), (893, 150), (872, 150), (840, 148), (800, 168), (700, 178), (620, 175),
]

LANTERN = [(497, 300), (538, 242), (562, 248), (568, 300), (562, 404), (505, 410), (493, 356)]

# Design pumpkin (1.jpg). Its top is hidden behind the ghost's hem in the design, so it is
# only used to cut the ghost and is then removed from the plate and replaced (see below).
PUMPKIN_X = (436, 742)
PUMPKIN_TRACE_X = (540, 742)  # columns where the ghost hem sits behind the pumpkin
PUMPKIN_DEFAULT_TOP = 478
PUMPKIN_BODY = ((591, 566), (160, 112))  # ellipse (centre, radii) bounding the body

# Replacement: the complete approved pumpkin from 3.jpg (3.jpg coords), placed over the
# design pumpkin so its centre and base line up.
REF_PUMPKIN = [
    (443, 226), (500, 165), (545, 172), (588, 106), (616, 106), (614, 140), (640, 98),
    (676, 101), (702, 150), (752, 226), (830, 230), (902, 284), (940, 380), (931, 450),
    (922, 520), (929, 560), (900, 602), (560, 602), (518, 592), (488, 572), (462, 556),
    (448, 520), (446, 420), (446, 330), (444, 280),
]
REF_BODY_X = (452, 935)       # body width in 3.jpg
REF_BASE = (693.5, 563)       # body bottom-centre in 3.jpg
DESIGN_BASE = (593, 664)      # where it lands in 1.jpg
DESIGN_BODY_W = 326           # body width in 1.jpg
REF_BODY = ((693.5, 398), (240, 164))  # body ellipse: always solid, even where it is dark
REF_RIM_PATCH = (440, 432, 520, 580)    # left rim hidden by a candle -> rebuilt from the right rim
REF_FACE_BOX = (505, 255, 885, 535)
REF_FLAME = (690, 470)        # candle inside the pumpkin (seen through the mouth)
REF_EYES = (690, 335)
REF_STEM_BASE = (690, 236)
EMBER = np.array([4, 10, 28], np.float32)  # unlit carved face, BGR
COLOR_MATCH = 0.55            # how far the replacement is pulled toward the design pumpkin

LEAVES = {  # 3.jpg coords
    "leaf-1": (955, 136, 1112, 276),
    "leaf-2": (190, 96, 280, 168),
    "leaf-3": (212, 290, 308, 348),
    "leaf-4": (468, 38, 612, 124),
}


# ---- helpers ------------------------------------------------------------------------------

def up(v):
    return int(round(v * UP))


def lift_blacks(bgr):
    """Screen-blend with the page colour so pure black == page background."""
    f = bgr.astype(np.float32)
    return 255 - (255 - f) * (255 - BG) / 255


def fill_holes(mask):
    h, w = mask.shape
    flood = mask.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    return mask | cv2.bitwise_not(flood)


def largest(mask):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    if n <= 1:
        return mask
    return np.where(labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)


def poly_mask(shape, pts, scale=UP):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts, np.float32) * scale).astype(np.int32)], 255)
    return m


def save_rgba(name, bgr, alpha, scale):
    rgba = np.dstack([np.clip(bgr, 0, 255).astype(np.uint8), np.clip(alpha, 0, 255).astype(np.uint8)])
    rgba = cv2.resize(rgba, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    path = OUT / f"{name}.webp"
    cv2.imwrite(str(path), rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])
    print(f"wrote {path.relative_to(ROOT)}  {rgba.shape[1]}x{rgba.shape[0]}")


def load_upscaled(name):
    path = CACHE / f"{name}@4x.png"
    if not path.exists():
        raise SystemExit(f"missing {path.relative_to(ROOT)} — run Real-ESRGAN first (see module docstring)")
    return cv2.imread(str(path))


# ---- stages -------------------------------------------------------------------------------

def clean_reference(img):
    h, w = img.shape[:2]
    # divider: interpolate its rows from the rows above/below
    top, bot = DIVIDER_ROWS_4X
    a, b = img[top].astype(np.float32), img[bot].astype(np.float32)
    for y in range(top + 1, bot):
        t = (y - top) / (bot - top)
        img[y] = (a * (1 - t) + b * t).astype(np.uint8)
    # overlapping UI text
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    text = np.zeros((h, w), np.uint8)
    for box in TEXT_BOXES:
        x0, y0, x1, y1 = (up(v) for v in box)
        text[y0:y1, x0:x1] = np.where(gray[y0:y1, x0:x1] > 38, 255, 0)
    text = cv2.dilate(text, np.ones((up(3), up(3)), np.uint8))
    return cv2.inpaint(img, text, up(4), cv2.INPAINT_TELEA)


def small_ghost_mask(img, box):
    x0, y0, x1, y1 = (up(v) for v in box)
    crop = img[y0:y1, x0:x1]
    mask = np.zeros(crop.shape[:2], np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    r = up(4)
    cv2.grabCut(crop, mask, (r, r, crop.shape[1] - 2 * r, crop.shape[0] - 2 * r), bgd, fgd, 5,
                cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    m &= np.where(gray > 70, 255, 0).astype(np.uint8)
    m = largest(m)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((up(5), up(5)), np.uint8))
    m = fill_holes(m)
    full = np.zeros(img.shape[:2], np.uint8)
    full[y0:y1, x0:x1] = m
    return full


def pumpkin_mask(img):
    """Pumpkin (+ everything in front of it) — its top edge is where the bright ghost hem ends."""
    h, w = img.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (0, 0), 2)
    xs = np.arange(up(PUMPKIN_X[0]), up(PUMPKIN_X[1]))
    top = np.full(xs.shape, up(PUMPKIN_DEFAULT_TOP), np.float32)
    t0, t1 = up(PUMPKIN_TRACE_X[0]), up(PUMPKIN_TRACE_X[1])
    start, stop = up(530), up(420)
    for i, x in enumerate(xs):
        if not (t0 <= x < t1):
            continue
        col = gray[stop:start, x][::-1]  # scan upward from inside the pumpkin
        hit = np.argmax(col > 105)
        if col[hit] > 105:
            top[i] = start - hit
    top = cv2.GaussianBlur(top.reshape(1, -1), (0, 0), up(1.5)).ravel()
    m = np.zeros((h, w), np.uint8)
    for i, x in enumerate(xs):
        m[int(top[i]):, x] = 255
    body = np.zeros((h, w), np.uint8)
    (cx, cy), (rx, ry) = PUMPKIN_BODY
    cv2.ellipse(body, (up(cx), up(cy)), (up(rx), up(ry)), 0, 0, 360, 255, -1)
    body[: up(cy)] |= m[: up(cy)] & np.where(np.abs(np.arange(w) - up(cx)) < up(rx), 255, 0).astype(np.uint8)[None, :]
    return cv2.GaussianBlur(m & body, (0, 0), up(0.6))


def main_ghost_mask(img, pumpkin):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    poly = poly_mask(gray.shape, MAIN_GHOST)
    # shrink-wrap: drop dark sky that is connected to the outside of the outline
    dark = np.where(cv2.GaussianBlur(gray, (0, 0), 3) < 22, 255, 0).astype(np.uint8)
    reach = (dark | ~poly).copy()
    ff = np.zeros((reach.shape[0] + 2, reach.shape[1] + 2), np.uint8)
    cv2.floodFill(reach, ff, (0, 0), 128)
    m = poly & ~np.where(reach == 128, 255, 0).astype(np.uint8)
    m |= (poly_mask(gray.shape, HAT_CROWN) | poly_mask(gray.shape, LANTERN)) & poly
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((up(2), up(2)), np.uint8))
    m = largest(m)
    m = fill_holes(m)
    # along the outline, let dim pixels (glow halos around the moon/lantern) fade by
    # brightness instead of ending on a hard cut
    band = (m > 0) & ~(cv2.erode(m, np.ones((up(10), up(10)), np.uint8)) > 0)
    fade = np.clip((cv2.GaussianBlur(gray, (0, 0), 2).astype(np.float32) - 12) / 50, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), up(0.5)).astype(np.float32)
    m = np.where(band, m * fade, m)
    m = cv2.GaussianBlur(m, (0, 0), up(0.4))
    # everything the pumpkin covers belongs to the pumpkin layer
    return m * (1 - pumpkin.astype(np.float32) / 255)


def face_mask(img, box):
    x0, y0, x1, y1 = (up(v) for v in box)
    v = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 2].astype(np.float32)
    lit = np.clip((v - 120) / 90, 0, 1)
    m = np.zeros(lit.shape, np.float32)
    m[y0:y1, x0:x1] = lit[y0:y1, x0:x1]
    return cv2.GaussianBlur(m, (0, 0), up(0.7))


def ref_pumpkin(ref):
    """Complete pumpkin from 3.jpg: (bgr, alpha 0..1, face 0..1, crop origin) in 4x ref space."""
    ref = ref.copy()
    # a candle hides the lower left rim: rebuild it from the mirrored right rim, blending
    # in from the outer edge so the inner surface stays original
    px0, py0, px1, py1 = (up(v) for v in REF_RIM_PATCH)
    cx2 = 2 * up(REF_BASE[0])
    mirrored = ref[py0:py1, cx2 - px1 + 1:cx2 - px0 + 1][:, ::-1].astype(np.float32)
    xx = np.arange(px1 - px0, dtype=np.float32)[None, :]
    yy = np.arange(py1 - py0, dtype=np.float32)[:, None]
    w = np.clip((px1 - px0 - xx) / up(22), 0, 1) * np.clip(yy / up(26), 0, 1)
    w = (w * w * (3 - 2 * w))[..., None]
    ref[py0:py1, px0:px1] = (ref[py0:py1, px0:px1] * (1 - w) + mirrored * w).astype(np.uint8)

    gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
    poly = poly_mask(gray.shape, REF_PUMPKIN)
    dark = np.where(cv2.GaussianBlur(gray, (0, 0), 3) < 26, 255, 0).astype(np.uint8)
    reach = (dark | ~poly).copy()
    ff = np.zeros((reach.shape[0] + 2, reach.shape[1] + 2), np.uint8)
    cv2.floodFill(reach, ff, (0, 0), 128)
    m = poly & ~np.where(reach == 128, 255, 0).astype(np.uint8)
    body = np.zeros_like(m)
    (bx, by), (brx, bry) = REF_BODY
    cv2.ellipse(body, (up(bx), up(by)), (up(brx), up(bry)), 0, 0, 360, 255, -1)
    m |= body & poly
    # below the leaves, the left silhouette follows the body curve (the original edge there
    # sits in candle light and bleeds into the background)
    left = np.zeros_like(m)
    left[up(300):up(548), :up(482)] = 255
    m &= ~(left & ~cv2.dilate(body, np.ones((up(3), up(3)), np.uint8)))
    m = fill_holes(largest(cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((up(2), up(2)), np.uint8))))
    alpha = cv2.GaussianBlur(m, (0, 0), up(0.6)).astype(np.float32) / 255
    # settle the base into the floor instead of ending on a hard line
    yy = np.arange(alpha.shape[0], dtype=np.float32)[:, None]
    alpha *= np.clip((up(586) - yy) / up(14), 0, 1)

    ys, xs = np.nonzero(alpha > 0.004)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    face = face_mask(ref, REF_FACE_BOX)
    return ref[y0:y1, x0:x1], alpha[y0:y1, x0:x1], face[y0:y1, x0:x1], (x0, y0)


def color_match(src, src_w, tgt, tgt_w, strength):
    """Shift src toward tgt's LAB mean/std (weighted), by `strength`."""
    s_lab = cv2.cvtColor(np.clip(src, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    t_lab = cv2.cvtColor(tgt, cv2.COLOR_BGR2LAB).astype(np.float32)
    sw, tw = src_w > 0.5, tgt_w > 0.5
    mu_s, sd_s = s_lab[sw].mean(0), s_lab[sw].std(0) + 1e-3
    mu_t, sd_t = t_lab[tw].mean(0), t_lab[tw].std(0) + 1e-3
    out = (s_lab - mu_s) / sd_s * sd_t + mu_t
    out = s_lab + (out - s_lab) * strength
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)


def scene_vignette(clean_crop):
    sh, sw = clean_crop.shape[:2]
    yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
    nx = (xx - sw * 0.5) / (sw * 0.5)
    ny = (yy - sh * 0.56) / (sh * 0.5)
    d = (np.abs(nx) ** 4 + np.abs(ny) ** 4) ** 0.25
    t = np.clip((d - 0.45) / 0.55, 0, 1)
    vig = 1 - t * t * (3 - 2 * t)
    e = UP
    hard = np.minimum.reduce([
        np.clip(xx / (24 * e), 0, 1), np.clip((sw - 1 - xx) / (24 * e), 0, 1),
        np.clip(yy / (16 * e), 0, 1), np.clip((sh - 1 - yy) / (16 * e), 0, 1),
    ])
    lum = cv2.cvtColor(clean_crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lit = np.clip((lum - 24) / 46, 0, 1)
    return hard, vig, lit


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    img = clean_reference(load_upscaled("1"))
    H, W = img.shape[:2]
    clean1x = cv2.resize(img, (W // UP, H // UP), interpolation=cv2.INTER_AREA)
    sx0, sy0, sx1, sy1 = (up(v) for v in SCENE)
    sw, sh = sx1 - sx0, sy1 - sy0
    k = EXPORT / UP
    boxes = {}

    def box_pct(x0, y0, x1, y1):
        return {
            "left": round((x0 - sx0) / sw * 100, 4),
            "top": round((y0 - sy0) / sh * 100, 4),
            "width": round((x1 - x0) / sw * 100, 4),
            "height": round((y1 - y0) / sh * 100, 4),
        }

    def cut(name, alpha, src=img, pad=up(4)):
        ys, xs = np.nonzero(alpha > 1)
        x0, x1 = max(xs.min() - pad, sx0), min(xs.max() + pad, sx1)
        y0, y1 = max(ys.min() - pad, sy0), min(ys.max() + pad, sy1)
        save_rgba(name, lift_blacks(src[y0:y1, x0:x1]), alpha[y0:y1, x0:x1], k)
        boxes[name] = box_pct(x0, y0, x1, y1)

    # --- masks
    pumpkin = pumpkin_mask(img)
    ghost_main = main_ghost_mask(img, pumpkin)
    smalls = {n: small_ghost_mask(img, b) for n, b in SMALL_GHOSTS.items()}

    # --- background plate: remove every ghost with a 1x inpaint (smoothed inside the hole
    # only, so its boundary stays continuous with the surroundings). The design pumpkin stays:
    # the replacement covers it, and inpainting its lit face would smear light everywhere.
    holes = np.zeros((H, W), np.uint8)
    for m in [ghost_main, *smalls.values()]:
        holes |= (m > 20).astype(np.uint8) * 255
    h1 = cv2.resize(holes, (clean1x.shape[1], clean1x.shape[0]), interpolation=cv2.INTER_AREA)
    h1 = cv2.dilate((h1 > 0).astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
    fill = cv2.inpaint(clean1x, h1, 9, cv2.INPAINT_TELEA).astype(np.float32)
    inner = cv2.GaussianBlur(cv2.erode(h1, np.ones((5, 5), np.uint8)), (0, 0), 3).astype(np.float32)[..., None] / 255
    fill = fill * (1 - inner) + cv2.GaussianBlur(fill, (0, 0), 6) * inner
    fill4x = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC)
    soft = cv2.resize(cv2.GaussianBlur(h1, (0, 0), 1), (W, H), interpolation=cv2.INTER_LINEAR)
    soft = soft.astype(np.float32)[..., None] / 255
    back = img.astype(np.float32) * (1 - soft) + fill4x * soft

    hard, vig, lit = scene_vignette(np.clip(back[sy0:sy1, sx0:sx1], 0, 255).astype(np.uint8))
    keep = cv2.GaussianBlur(poly_mask((H, W), HAT_CROWN)[sy0:sy1, sx0:sx1], (0, 0), up(6)) / 255
    back_alpha = 255 * hard * (np.maximum(vig, keep) + (1 - np.maximum(vig, keep)) * lit)
    save_rgba("scene-back", lift_blacks(back[sy0:sy1, sx0:sx1]), back_alpha, k)
    boxes["scene-back"] = box_pct(sx0, sy0, sx1, sy1)

    # --- character layers
    cut("ghost-main", ghost_main)
    for name, m in smalls.items():
        a = cv2.GaussianBlur(cv2.erode(m, np.ones((up(2), up(2)), np.uint8)), (0, 0), up(0.8)).astype(np.float32)
        cut(name, a)

    # --- pumpkin: the complete pumpkin from 3.jpg, colour-matched to the design pumpkin,
    # exported as an unlit body + a separate lit face
    ref = load_upscaled("3")
    pbgr, palpha, pface, (ox, oy) = ref_pumpkin(ref)
    design_face = face_mask(img, (515, 505, 725, 655))
    design_body = (pumpkin.astype(np.float32) / 255) * (1 - np.clip(design_face * 3, 0, 1))
    matched = color_match(pbgr, palpha * (1 - np.clip(pface * 3, 0, 1)), img, design_body, COLOR_MATCH)
    keep_face = np.clip(pface * 2, 0, 1)[..., None]
    pbgr = matched * (1 - keep_face) + pbgr * keep_face  # the carved light keeps its own colour

    s = DESIGN_BODY_W / (REF_BODY_X[1] - REF_BODY_X[0])

    def to_design(rx, ry):  # 4x ref coords -> 4x design coords
        return (up(DESIGN_BASE[0]) + (rx - up(REF_BASE[0])) * s,
                up(DESIGN_BASE[1]) + (ry - up(REF_BASE[1])) * s)

    dx0, dy0 = to_design(ox, oy)
    dx1, dy1 = to_design(ox + pbgr.shape[1], oy + pbgr.shape[0])
    f = np.clip(pface * 1.8, 0, 1)[..., None]  # unlit: the whole carving goes to ember
    save_rgba("pumpkin", lift_blacks(pbgr * (1 - f) + EMBER * f), palpha * 255, s * k)
    save_rgba("pumpkin-face", lift_blacks(pbgr), pface * palpha * 255, s * k)
    boxes["pumpkin"] = boxes["pumpkin-face"] = box_pct(dx0, dy0, dx1, dy1)

    def point(name, p):
        x, y = to_design(up(p[0]), up(p[1]))
        boxes[name] = {"left": round((x - sx0) / sw * 100, 3), "top": round((y - sy0) / sh * 100, 3)}

    point("flame", REF_FLAME)
    point("eyes", REF_EYES)
    point("emerge", REF_STEM_BASE)
    point("base", REF_BASE)
    boxes["pumpkin-width"] = round(DESIGN_BODY_W * UP / sw * 100, 3)

    # --- leaves
    for name, (lx0, ly0, lx1, ly1) in LEAVES.items():
        crop = ref[up(ly0):up(ly1), up(lx0):up(lx1)]
        mx = crop.max(axis=2).astype(np.float32)
        a = np.clip((mx - 28) / 50, 0, 1)
        keep_leaf = cv2.dilate(largest((a > 0.5).astype(np.uint8) * 255), np.ones((up(5), up(5)), np.uint8))
        save_rgba(name, crop.astype(np.float32), a * keep_leaf, 0.5)

    boxes["aspect"] = round(sw / sh, 6)
    (OUT / "layers.json").write_text(json.dumps(boxes, indent=2))
    print("wrote", (OUT / "layers.json").relative_to(ROOT))


if __name__ == "__main__":
    main()
