#!/usr/bin/env python3
"""
Destination image pipeline.

The problem this solves: a solo founder needs one image per destination,
legally, forever, and images pulled from Unsplash, Wikimedia and a tourism
board look like a jumble when placed side by side. Airalo has this problem
visibly on their homepage.

The fix is to stop treating them as photographs and start treating them as
inputs to a fixed process. Every image, wherever it came from, goes through the
same five steps and comes out belonging to one family:

  1. Crop to a fixed ratio around a focal point.
  2. Desaturate to luminance.
  3. Map that luminance across a two point ramp: shadows to the canvas colour,
     highlights to a per destination hue. This is duotone, and it is what makes
     twelve unrelated photographs read as one set.
  4. Overlay monochrome grain, which kills banding on OLED and is most of why
     the result reads as a photograph rather than as a fill.
  5. Apply a bottom scrim so type sits on it legibly at any crop.

This script demonstrates the process end to end. Because there is no photo
library here yet, step zero SYNTHESISES a plausible source frame per
destination (sky gradient, horizon, layered silhouettes) and then runs the real
pipeline over it. Swap `synthesise()` for `Image.open(path)` the day real
photography lands and steps one through five do not change.

Run:  python3 brand/make-destinations.py
Out:  brand/dest/<iso>.jpg  plus  brand/dest/inline.json (base64, for previews)
"""

import base64
import io
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 800
OUT = os.path.join(os.path.dirname(__file__), "dest")

# Shadow end of every ramp is the app canvas, so an image always sits on the
# background rather than floating above it as a rectangle.
INK = (8, 9, 12)

# Per destination highlight. Chosen from the place rather than from a palette
# generator: Bali is volcanic green, Japan is a cold rose, Lahore is late
# afternoon brass, China is lantern red.
DESTS = {
    "id": {"name": "Bali",     "hi": (128, 244, 208), "mid": (36, 112, 104), "shape": "volcano"},
    "jp": {"name": "Japan",    "hi": (250, 190, 205),"mid": (100, 70, 106),  "shape": "fuji"},
    "pk": {"name": "Pakistan", "hi": (252, 214, 138),"mid": (128, 92, 44),  "shape": "domes"},
    "cn": {"name": "China",    "hi": (250, 150, 132),"mid": (116, 52, 56),  "shape": "towers"},
    "th": {"name": "Thailand", "hi": (252, 218, 152),"mid": (112, 86, 46),  "shape": "domes"},
    "us": {"name": "United States","hi": (186, 208, 250),"mid": (56, 74, 116),"shape": "towers"},
}


# ── Step 0. Stand in for a real photograph ──────────────────────────────────
def synthesise(shape: str, seed: int) -> Image.Image:
    """A plausible source frame: graded sky, sun, haze, layered silhouettes.

    Layering matters more than draughtsmanship. Real landscape photographs read
    as depth because each successive ridge is lighter and lower in contrast
    than the one in front of it, which is atmospheric perspective. Four layers
    with decreasing darkness reproduces that convincingly enough to judge a
    layout on.
    """
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)

    # Sky, dark at the top to bright at the horizon, which is the direction
    # every real dusk sky runs.
    for y in range(H):
        t = y / H
        v = int(26 + 226 * (t ** 1.9))
        d.line([(0, y), (W, y)], fill=(v, v, v))

    # A low sun. Placed off centre because a centred sun looks like a diagram.
    sx, sy = int(W * (0.24 + rnd.random() * 0.5)), int(H * 0.62)
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for r in range(320, 0, -8):
        gd.ellipse([sx - r, sy - r * 0.75, sx + r, sy + r * 0.75],
                   fill=int(255 * (1 - r / 320) ** 2))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    img = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), img, glow)
    d = ImageDraw.Draw(img)

    horizon = int(H * 0.66)

    def ridge(base_y, height, roughness, value, points=26):
        """One silhouette layer, drawn as a filled polygon."""
        pts = [(0, H)]
        for i in range(points + 1):
            x = W * i / points
            n = (math.sin(i * 0.7 + seed) + math.sin(i * 1.9 + seed * 2)) * 0.5
            y = base_y - height * (0.5 + 0.5 * n) - rnd.random() * roughness
            pts.append((x, y))
        pts.append((W, H))
        d.polygon(pts, fill=(value, value, value))

    if shape == "volcano":
        ridge(horizon + 40, 60, 18, 96)
        # The cone. Bali's skyline is Agung, so the silhouette is a cone with a
        # flat notch, not a triangle.
        cx = int(W * 0.62)
        d.polygon([(cx - 300, horizon + 30), (cx - 40, horizon - 210),
                   (cx + 40, horizon - 210), (cx + 320, horizon + 30)], fill=(58, 58, 58))
        ridge(horizon + 120, 40, 12, 30)
        for i in range(7):  # palms
            px = int(W * (0.06 + i * 0.145)) + rnd.randint(-30, 30)
            ph = rnd.randint(110, 190)
            d.line([(px, H), (px + rnd.randint(-14, 14), H - ph)], fill=(12, 12, 12), width=7)
            for a in range(6):
                ang = math.pi * (0.15 + a * 0.14)
                d.line([(px, H - ph), (px + math.cos(ang) * 74, H - ph - math.sin(ang) * 46)],
                       fill=(12, 12, 12), width=6)
    elif shape == "fuji":
        ridge(horizon + 50, 44, 14, 104)
        cx = int(W * 0.42)
        d.polygon([(cx - 400, horizon + 40), (cx - 52, horizon - 250),
                   (cx + 52, horizon - 250), (cx + 430, horizon + 40)], fill=(52, 52, 52))
        d.polygon([(cx - 96, horizon - 190), (cx - 52, horizon - 250),
                   (cx + 52, horizon - 250), (cx + 100, horizon - 188),
                   (cx + 40, horizon - 214), (cx - 44, horizon - 210)], fill=(150, 150, 150))
        ridge(horizon + 150, 34, 10, 24)
    elif shape == "domes":
        ridge(horizon + 60, 40, 12, 100)
        # Three domes and a pair of minarets. Recognisable at a glance from a
        # silhouette alone, which is the test any of these has to pass.
        for i, (fx, s) in enumerate([(0.30, 1.0), (0.50, 1.35), (0.70, 1.0)]):
            cx = int(W * fx)
            rw, rh = int(86 * s), int(74 * s)
            d.rectangle([cx - rw, horizon - 20, cx + rw, horizon + 90], fill=(34, 34, 34))
            d.pieslice([cx - rw, horizon - 20 - rh, cx + rw, horizon - 20 + rh],
                       180, 360, fill=(34, 34, 34))
            d.line([(cx, horizon - 24 - rh), (cx, horizon - 60 - rh)], fill=(34, 34, 34), width=6)
        for fx in (0.16, 0.84):
            cx = int(W * fx)
            d.rectangle([cx - 16, horizon - 230, cx + 16, horizon + 90], fill=(28, 28, 28))
            d.pieslice([cx - 26, horizon - 264, cx + 26, horizon - 200], 180, 360, fill=(28, 28, 28))
        ridge(horizon + 170, 26, 8, 18)
    else:  # towers
        ridge(horizon + 70, 30, 10, 96)
        x = 0
        while x < W:
            bw = rnd.randint(46, 104)
            bh = rnd.randint(90, 330)
            v = rnd.randint(22, 48)
            d.rectangle([x, horizon + 60 - bh, x + bw, H], fill=(v, v, v))
            # Lit windows. Sparse, because a full grid looks like graph paper.
            for wy in range(horizon + 60 - bh + 16, H, 26):
                for wx in range(x + 10, x + bw - 10, 20):
                    if rnd.random() < 0.22:
                        d.rectangle([wx, wy, wx + 7, wy + 11], fill=(190, 190, 190))
            x += bw + rnd.randint(4, 16)

    return img.filter(ImageFilter.GaussianBlur(0.6))


# ── Steps 2 and 3. Duotone ──────────────────────────────────────────────────
def duotone(img: Image.Image, shadow, mid, highlight) -> Image.Image:
    """Map luminance across a three point ramp.

    Three points rather than two. A straight two point duotone crushes the
    middle of the range and the result looks like a printed risograph; adding a
    mid stop keeps the tonality of the original and is the difference between
    "stylised" and "cheap".
    """
    lum = img.convert("L")
    ramp = []
    for i in range(256):
        t = i / 255
        if t < 0.5:
            k = t / 0.5
            c = [shadow[j] + (mid[j] - shadow[j]) * k for j in range(3)]
        else:
            k = (t - 0.5) / 0.5
            c = [mid[j] + (highlight[j] - mid[j]) * k for j in range(3)]
        ramp.append(tuple(int(v) for v in c))

    out = Image.new("RGB", img.size)
    out.putdata([ramp[p] for p in lum.getdata()])
    return out


# ── Step 4. Grain ───────────────────────────────────────────────────────────
def grain(img: Image.Image, amount: float = 9.0) -> Image.Image:
    """Monochrome noise, added not multiplied.

    Large dark gradients band visibly on OLED panels, which is exactly what a
    duotone destination image is. Grain dithers the steps away. It also costs
    nothing and is most of the reason an expensive dark interface reads as a
    photograph rather than as a fill.
    """
    rnd = random.Random(7)
    noise = Image.new("L", img.size)
    noise.putdata([int(128 + (rnd.random() - 0.5) * amount * 2)
                   for _ in range(img.size[0] * img.size[1])])
    noise = noise.convert("RGB")
    return Image.blend(img, Image.merge("RGB", [
        Image.eval(noise.split()[i], lambda v: v) for i in range(3)]), 0.06)


# ── Step 5. Scrim ───────────────────────────────────────────────────────────
def scrim(img: Image.Image) -> Image.Image:
    """Darken the bottom third so type is legible over any crop.

    Baked into the asset rather than layered in CSS, because the same file is
    used by the app, the website and the Play Store listing, and only one of
    those three can apply a gradient overlay.
    """
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    for y in range(h):
        t = max(0.0, (y - h * 0.56) / (h * 0.44))
        md.line([(0, y), (w, y)], fill=int(205 * (t ** 1.6)))
    return Image.composite(Image.new("RGB", (w, h), INK), img, mask)


def build(iso: str, spec: dict, seed: int) -> Image.Image:
    src = synthesise(spec["shape"], seed)          # step 0, replace with Image.open
    img = duotone(src, INK, spec["mid"], spec["hi"])  # steps 2 and 3
    img = grain(img)                                # step 4
    return scrim(img)                               # step 5


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    inline = {}
    for i, (iso, spec) in enumerate(DESTS.items()):
        img = build(iso, spec, seed=i * 13 + 3)
        img.save(os.path.join(OUT, f"{iso}.jpg"), quality=86, optimize=True)

        # A small inline copy, so a single file preview can carry its own
        # imagery with no server and no asset pipeline.
        small = img.resize((600, 400), Image.LANCZOS)
        buf = io.BytesIO()
        small.save(buf, format="JPEG", quality=72, optimize=True)
        inline[iso] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        print(f"  {iso}  {spec['name']:<14} {len(inline[iso]) // 1024} KB inline")

    with open(os.path.join(OUT, "inline.json"), "w") as f:
        json.dump(inline, f)
    print(f"\nWrote {len(DESTS)} destinations to {OUT}")


if __name__ == "__main__":
    main()
