#!/usr/bin/env python3
"""
Brand asset generator.

Produces every icon size Google Play and the web actually require, from one
parametric definition, so a name or colour change is a re-run rather than a
day in a design tool.

The mark: a bilby's ears above a simple head. The ears do double duty — an
animal with famously oversized ears, and an antenna picking up signal. Both
readings land without explanation, which is what stops it being an animal logo
with nothing to do with the product.

Design constraints applied deliberately:
  * Three elements only. The launcher icon is 48dp and every extra element
    costs legibility there — that size is the only brand impression most users
    will ever consciously receive.
  * No gradients in the small sizes. They band on low-end panels and muddy the
    silhouette at 48px.
  * The glyph is auto-centred by its alpha bounding box, not by hand-tuned
    offsets. The ears are asymmetric and tilted, so the geometric centre of the
    drawing instructions is not the optical centre of the result.
  * ~62% canvas coverage. Android's adaptive-icon system crops to a circle and
    applies parallax, so anything past ~66% risks clipping the ear tips.

Run:  python3 make-icons.py
"""

from PIL import Image, ImageDraw
import os
import math

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

BG = (7, 9, 13)
SURFACE = (14, 19, 25)
ACCENT = (46, 230, 168)
ACCENT_DIM = (16, 169, 122)
TEXT = (232, 238, 245)

# Supersample factor. Pillow has no anti-aliased polygon fill, so we draw big
# and downsample — cheaper and sharper than hand-rolling coverage AA.
SS = 8


def _mark(size, fg=ACCENT, fg2=ACCENT_DIM, bg=None, radius_ratio=0.2237,
          coverage=0.62):
    """Render the mark at `size` px. bg=None gives a transparent canvas.

    The glyph is drawn on its own transparent layer, then measured and
    recentred by its actual alpha bounding box before being composited. Doing
    it by measurement rather than by hand-tuned offsets matters because the two
    ears are asymmetric and tilted — the geometric centre of the drawing
    instructions is not the optical centre of the result, and eyeballing it
    leaves the mark drifting low and left at every size at once.

    `coverage` is the fraction of the canvas the glyph occupies. Kept at 0.62
    because Android crops adaptive icons to a circle and applies parallax;
    past ~0.66 the ear tips clip on some launchers.
    """
    S = size * SS
    glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(glyph)
    img = glyph

    scale = S / 1024.0
    cx, cy = S / 2, S * 0.62

    # ── The bilby mark ────────────────────────────────────────────────────
    #
    # A bilby's defining feature is its ears — outsized, upright, and built for
    # picking up the faintest sound. That is a gift for a connectivity brand:
    # the same two shapes read simultaneously as ears and as an antenna
    # receiving signal. Nobody has to explain the joke for the mark to work,
    # and it stops being an animal logo with nothing to do with the product.
    #
    # Kept to three elements — two ears, one head — because the launcher icon
    # is 48dp and every extra element costs legibility there. The earlier wing
    # mark died of exactly that.

    def ear(tilt_deg, height, width_px, alpha=255, colour=None):
        """One ear: a rounded capsule, tilted outward from the head."""
        h = height * scale
        w = width_px * scale
        # Draw upright on its own layer, then rotate — PIL cannot draw a
        # rotated rounded rect, and rotating a whole layer keeps the corner
        # radius true instead of shearing it.
        pad = int(h + w)
        layer = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        left = pad - w / 2
        ld.rounded_rectangle(
            [left, pad - h, left + w, pad],
            radius=w / 2,
            fill=(colour or fg) + (alpha,),
        )
        rot = layer.rotate(-tilt_deg, resample=Image.BICUBIC, center=(pad, pad))
        img.alpha_composite(
            rot, dest=(int(cx - pad), int(cy - pad + 30 * scale))
        )

    # Asymmetric on purpose: equal ears read as a logo mark, slightly unequal
    # ears read as an animal. The difference is small and it is the whole
    # reason this looks alive.
    ear(tilt_deg=-19, height=430, width_px=132)          # left, taller
    ear(tilt_deg=21, height=372, width_px=126, colour=fg2)  # right, shorter

    # Head — a simple dome. Anchors the ears so they don't float.
    hr = 150 * scale
    d.ellipse(
        [cx - hr, cy - hr * 0.72, cx + hr, cy + hr * 1.12],
        fill=fg + (255,),
    )

    # Measure what was actually drawn, then fit it to the canvas.
    box = glyph.getbbox()
    if box:
        cropped = glyph.crop(box)
        target = int(S * coverage)
        w, h = cropped.size
        ratio = min(target / w, target / h)
        cropped = cropped.resize(
            (max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS
        )
        centred = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        centred.paste(
            cropped,
            ((S - cropped.width) // 2, (S - cropped.height) // 2),
            cropped,
        )
        glyph = centred

    if bg is None:
        return glyph.resize((size, size), Image.LANCZOS)

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=int(S * radius_ratio), fill=bg
    )
    canvas.alpha_composite(glyph)
    return canvas.resize((size, size), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("  ", os.path.relpath(path, OUT))


def main():
    print("Play Store / web icons")
    # Play Console store icon — exactly 512x512, 32-bit PNG, no transparency.
    save(_mark(512, bg=BG), f"{OUT}/play/icon-512.png")
    # Maskable + standard PWA icons.
    for s in (192, 512):
        save(_mark(s, bg=BG), f"{OUT}/web/icon-{s}.png")
    save(_mark(180, bg=BG), f"{OUT}/web/apple-touch-icon.png")
    save(_mark(32, bg=BG, radius_ratio=0.18), f"{OUT}/web/favicon-32.png")

    print("Android launcher (legacy mipmaps)")
    for name, s in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
        save(_mark(s, bg=BG), f"{OUT}/android/mipmap-{name}/ic_launcher.png")
        save(_mark(s, bg=BG, radius_ratio=0.5), f"{OUT}/android/mipmap-{name}/ic_launcher_round.png")

    print("Android adaptive foreground (transparent, 108dp with 18dp safe margin)")
    for name, s in [("mdpi", 108), ("hdpi", 162), ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432)]:
        # Adaptive foregrounds are cropped to a circle of ~72/108 of the canvas.
        # Draw the mark into the inner 66% so nothing is ever clipped.
        save(_mark(s, coverage=0.44),
             f"{OUT}/android/mipmap-{name}/ic_launcher_foreground.png")

    print("Play feature graphic (1024x500)")
    fg = Image.new("RGB", (1024, 500), BG)
    d = ImageDraw.Draw(fg)
    for i in range(500):  # subtle vertical lift, safe at this size
        t = i / 500
        d.line([(0, i), (1024, i)], fill=(
            int(BG[0] + (SURFACE[0] - BG[0]) * t),
            int(BG[1] + (SURFACE[1] - BG[1]) * t),
            int(BG[2] + (SURFACE[2] - BG[2]) * t)))
    m = _mark(230)
    fg.paste(m, (92, 135), m)
    save(fg.convert("RGB"), f"{OUT}/play/feature-graphic-1024x500.png")

    print("\nDone. Note: the feature graphic has no text — add the wordmark and")
    print("tagline in your own tool, since Play rejects graphics where text is")
    print("clipped by the 1024x500 safe area on small screens.")


if __name__ == "__main__":
    main()
