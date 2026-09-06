#!/usr/bin/env python3
"""
Bilby icon generator.

One vector master (bilby-mark.svg) becomes every icon the web, Play and iOS
actually require. A colour or geometry change is a re-run of this file, not an
afternoon in a design tool and eleven exports that drift apart.

Why the sizes differ in how much of the canvas the glyph fills:

  * Android adaptive icons live on a 108dp canvas of which only the central
    72dp is guaranteed visible. Launchers crop to a circle, a squircle or a
    rounded square, and apply parallax on top. Anything past about 62% of the
    canvas risks losing an ear tip on somebody's phone, and you never see it.
  * A favicon has no such crop, so the glyph fills the canvas properly. A mark
    drawn at adaptive-icon coverage looks lost at 16px.
  * Apple applies its own corner mask to apple-touch-icon and does NOT respect
    transparency: a transparent PNG composites onto black. So that one is
    always flattened onto the brand ground.

The glyph is centred by its measured alpha bounding box, never by hand tuned
offsets. The ears are tilted and the antenna is off the top, so the geometric
centre of the drawing instructions is not the optical centre of the result.

Run:  python3 make-brand-icons.py
"""

import io
import os
import cairosvg
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, "bilby-mark.svg")
OUT = os.path.abspath(os.path.join(HERE, "..", "assets"))

# Brand ground. Ink navy, from DECISIONS.md. The darkest thing on screen is the
# thing you press, and here it is the thing you tap.
GROUND = (11, 32, 56, 255)
CREAM = (247, 239, 228, 255)

# Apple's superellipse approximation. Kept identical across every rounded
# output so the family looks like a family.
CORNER = 0.2237

# Supersample before downscaling. Cairo antialiases, but a 16px favicon
# rendered directly is visibly worse than a 256px render reduced with Lanczos.
SS = 8


# --------------------------------------------------------------------------
# The mono layer is derived, not drawn twice.
#
# Android themed icons take a single colour layer. A flat alpha silhouette of
# the mark is useless: flattened, it is an anonymous blob with ears. So the
# visor is subtracted from the solid shape and the eyes and smile are added
# back, giving a one ink mark that still has a face.
# --------------------------------------------------------------------------
_HEAD = """<path d="M256 168 L256 100" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
<circle cx="256" cy="88" r="20" fill="#fff"/>
<ellipse cx="168" cy="168" rx="44" ry="108" transform="rotate(-34 168 168)" fill="#fff"/>
<ellipse cx="344" cy="168" rx="44" ry="108" transform="rotate(34 344 168)" fill="#fff"/>
<path d="M256 148 C 341 148, 396 209, 396 288 C 396 372, 337 424, 256 424
         C 175 424, 116 372, 116 288 C 116 209, 171 148, 256 148 Z" fill="#fff"/>"""

_VISOR = """<path d="M256 200 C 325 200, 366 236, 366 291 C 366 348, 322 382, 256 382
         C 190 382, 146 348, 146 291 C 146 236, 187 200, 256 200 Z" fill="#fff"/>"""

_FACE = """<rect x="188" y="256" width="50" height="59" rx="21" fill="#fff"/>
<rect x="274" y="256" width="50" height="59" rx="21" fill="#fff"/>
<path d="M231 340 C 243 355, 269 355, 281 340" stroke="#fff" stroke-width="11"
      stroke-linecap="round" fill="none"/>"""


def _svg(body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
            f"{body}</svg>")


def _render(svg_or_path: str, px: int, is_path=False) -> Image.Image:
    buf = io.BytesIO()
    kw = {"url": svg_or_path} if is_path else {"bytestring": svg_or_path.encode()}
    cairosvg.svg2png(write_to=buf, output_width=px, output_height=px, **kw)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")


def colour_glyph(px: int) -> Image.Image:
    return _render(MASTER, px, is_path=True)


def mono_glyph(px: int, rgb=(255, 255, 255)) -> Image.Image:
    """Solid shape minus the visor, plus the face, as a single colour."""
    a = _render(_svg(_HEAD), px).getchannel("A")
    b = _render(_svg(_VISOR), px).getchannel("A")
    c = _render(_svg(_FACE), px).getchannel("A")
    alpha = Image.eval(Image.merge("L", [a]), lambda v: v)
    # subtract the visor, then add the face back
    from PIL import ImageChops
    alpha = ImageChops.subtract(a, b)
    alpha = ImageChops.lighter(alpha, c)
    out = Image.new("RGBA", (px, px), rgb + (0,))
    out.putalpha(alpha)
    return out


# --------------------------------------------------------------------------
# Placement
# --------------------------------------------------------------------------

def _fit(glyph: Image.Image, canvas: int, coverage: float) -> Image.Image:
    """Centre `glyph` on a transparent canvas so its bounding box occupies
    `coverage` of the canvas along its longer side."""
    bbox = glyph.getchannel("A").getbbox()
    g = glyph.crop(bbox)
    target = canvas * coverage
    scale = target / max(g.width, g.height)
    w, h = max(1, round(g.width * scale)), max(1, round(g.height * scale))
    g = g.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(g, ((canvas - w) // 2, (canvas - h) // 2))
    return out


def _rounded(canvas: int, fill, radius_ratio=CORNER) -> Image.Image:
    from PIL import ImageDraw
    big = canvas * 4
    m = Image.new("L", (big, big), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, big - 1, big - 1],
                                        radius=int(big * radius_ratio), fill=255)
    m = m.resize((canvas, canvas), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), fill)
    out.putalpha(m)
    return out


def tile(size: int, coverage: float, ground=GROUND, rounded=True,
         mono=False, mono_rgb=(255, 255, 255)) -> Image.Image:
    glyph = mono_glyph(size * SS, mono_rgb) if mono else colour_glyph(size * SS)
    glyph = _fit(glyph, size, coverage)
    if ground is None:
        return glyph
    base = _rounded(size, ground) if rounded else Image.new("RGBA", (size, size), ground)
    base.alpha_composite(glyph)
    return base


def save(img: Image.Image, *parts, flatten=False):
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if flatten:
        bg = Image.new("RGB", img.size, GROUND[:3])
        bg.paste(img, mask=img.getchannel("A"))
        bg.save(path)
    else:
        img.save(path)
    print(f"  {os.path.relpath(path, OUT)}  {img.size[0]}px")


def main():
    print("web")
    for s in (16, 32, 48):
        save(tile(s, 0.86), "web", f"favicon-{s}.png")
    ico = [tile(s, 0.86).convert("RGB") for s in (16, 32, 48)]
    ico[2].save(os.path.join(OUT, "web", "favicon.ico"),
                sizes=[(16, 16), (32, 32), (48, 48)])
    print("  web/favicon.ico  16/32/48")

    # iOS ignores transparency and applies its own mask, so this one is a flat
    # square of ground with no corner rounding of our own.
    save(tile(180, 0.74, rounded=False), "web", "apple-touch-icon.png", flatten=True)

    for s in (192, 512):
        save(tile(s, 0.80), "web", f"icon-{s}.png")
        # maskable: full bleed square, glyph inside the safe circle
        save(tile(s, 0.60, rounded=False), "web", f"icon-{s}-maskable.png", flatten=True)

    print("play")
    save(tile(512, 0.78, rounded=False), "play", "icon-512.png", flatten=True)

    print("android adaptive")
    # 108dp canvas per density. Foreground is transparent; the ground is a
    # colour resource so the launcher can animate the two layers apart.
    for name, px in (("mdpi", 108), ("hdpi", 162), ("xhdpi", 216),
                     ("xxhdpi", 324), ("xxxhdpi", 432)):
        d = f"mipmap-{name}"
        save(tile(px, 0.62, ground=None), "android", d, "ic_launcher_foreground.png")
        save(tile(px, 0.62, ground=None, mono=True), "android", d,
             "ic_launcher_monochrome.png")
    # legacy square and round launcher icons, for API levels without adaptive
    for name, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                     ("xxhdpi", 144), ("xxxhdpi", 192)):
        d = f"mipmap-{name}"
        save(tile(px, 0.80), "android", d, "ic_launcher.png", flatten=True)
        save(tile(px, 0.72, rounded=True, ground=GROUND), "android", d,
             "ic_launcher_round.png", flatten=True)

    print("source")
    save(tile(1024, 0.80), "source", "mark-on-ground-1024.png")
    save(tile(1024, 1.0, ground=None), "source", "mark-transparent-1024.png")
    save(tile(1024, 1.0, ground=None, mono=True, mono_rgb=(11, 32, 56)),
         "source", "mark-mono-ink-1024.png")
    save(tile(1024, 0.80, ground=CREAM), "source", "mark-on-cream-1024.png")


if __name__ == "__main__":
    main()
