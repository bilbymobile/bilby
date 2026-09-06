# The Bilby mark

One vector master, one generator, every size the web and Play require.

```
bilby-mark.svg          the drawing. The only file with geometry in it.
make-brand-icons.py     everything else. Run it, do not hand edit the outputs.
```

`web/src/app/home/mark.tsx` holds the same geometry again, as a single ink
version for the site header and the console. **If one changes, change both in
the same commit.** They are on the same 512 grid, so a coordinate copies
across unchanged.

## What the mark is

The hero character's head. Two ears, a helmet, an antenna, a visor.

Everything else in the render — the body, the limbs, the side port, the signal
arcs, the planet — is dropped. At launcher size the silhouette is the only
thing most people ever consciously see, and every extra element costs it.

Two decisions worth not undoing:

- **The ears are ellipses, not tapered points.** The character's ears are soft
  and floppy. A pointed ear reads as a fox and loses the animal entirely. Their
  lower ends sit inside the helmet, so there is no join to go wrong at 16px.
- **The eyes are rounded rectangles.** That is what makes the face read as a
  friendly machine rather than as an animal with two eyes.

## Coverage, and why it is not one number

| Output | Glyph fills | Because |
|---|---|---|
| favicon 16 / 32 / 48 | 86% | No crop is applied, and a mark drawn at adaptive coverage looks lost at 16px |
| PWA any, legacy launcher | 80% | Rounded corners only |
| apple touch icon | 74%, flattened | iOS applies its own mask and **ignores transparency**: a transparent PNG composites onto black |
| maskable, Android adaptive foreground | 60 to 62% | The 108dp canvas guarantees only the central 72dp. Launchers crop to a circle, a squircle or a rounded square and add parallax. Past about 66% an ear tip is lost on somebody's phone and you never find out |
| Play listing 512 | 78%, flat square | Play applies its own rounding |

## The monochrome layer

Android 13 and later can theme the launcher icon, which needs a single colour
layer. A flat alpha silhouette of this mark is useless: flattened, it becomes
an anonymous blob with ears.

So the visor is **subtracted** from the solid shape and the eyes and smile are
added back, giving a one ink mark that still has a face. That derivation lives
in `make-brand-icons.py`, not in a second hand drawn file, so it cannot drift.

## Android wiring

Copy `assets/android/mipmap-*/` into `app/android/app/src/main/res/`, then the
two XML files here:

- `ic_launcher.xml` into `mipmap-anydpi-v26/`, as both `ic_launcher.xml` and
  `ic_launcher_round.xml`
- `ic_launcher_background.xml` into `values/`

## Re-running

```
pip install cairosvg --break-system-packages
python3 make-brand-icons.py
cp ../assets/web/*.png ../assets/web/*.ico ../../web/public/
```

Outputs are committed. The generator is committed. Do not edit a PNG.
