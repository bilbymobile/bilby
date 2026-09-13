# Landing page v2, the night palette, archived 13 September 2026

A frozen copy of the marketing landing page, the hero artwork and the shared
stylesheet as they stood the moment before the third redesign began. Nothing
here is imported by the application. It exists so a decision can be reversed, or
so a piece of it can be lifted back, without reading a diff of a diff.

Commit at the time of archiving: `5411109`.

## What this version was

The first version the website, the web app and the Android app ever shared. One
palette, defined once in `globals.css`, taken hex for hex from the Expo app's
design system: void `#04060F` ground, coral `#FF7A3D` and mango `#FFB347`
carrying every action, aurora `#46F1D6` reserved for signal and for "this is
fine", sky `#5EC8FF` for links. Set in Space Grotesk throughout.

It replaced a cream page whose "Open the app" button crossed a customer into a
near black product that looked like a different company.

### The hero was drawn, not photographed

The version before this had a 262 KB JPEG of the mascot, marked priority and lit
for a cream page. On a phone browser on mobile data it was the thing that kept
arriving as a broken image glyph while the words waited behind it. So the scene
became vector: the character on the same 512 grid as the app icon, a halo, two
tilted orbits, and a planet limb clipped to the frame and faded into the page
ground. It cannot 404 and it cannot arrive late.

### Every number was derived

The headline, the destination list, the from price and the speed claim all read
the catalogue at render time. Nothing on the page was a number somebody typed,
because the version before it had said "13 destinations" on a day when one plan
was on sale.

### Motion never made anything visible

Every entrance was gated on `[data-motion="on"]`, set by an inline script only
once the document has actually been visible. Chrome does not start the document
timeline in a background tab, so an ungated entrance animation leaves its
element at the 0% keyframe indefinitely. Measured on production:
`document.timeline.currentTime` 0 against `performance.now()` 131141, with the
hero, the lede and the headline all present and all invisible.

## Why it is being replaced

Not because it was wrong. The brief moved: the reference deployment the whole
direction came from was read properly for the first time, in a real browser
rather than from a description, and two things in it turned out to be different
from what had been implemented.

- **The display face.** The written brand guidelines in the launch pack say
  Instrument Serif over Inter. The deployment's computed styles say Bebas Neue
  over Space Grotesk, and so does the Expo app's theme. Two out of three agreed
  with each other and disagreed with the document.
- **The motion vocabulary.** Eleven keyframes, of which this version had the
  equivalent of three. Missing: an ambient glow that drifts, cards that float,
  ears that sway, a ticker, a pulsing status dot.

## What must not come back with the new one

The reference runs 25 concurrent animations over a full bleed photograph with
session recording loaded. Asking Chrome for a screenshot of it timed out after
thirty seconds with the renderer unresponsive. The complaint that started this
entire redesign was that the site was slow on a phone and the character
disappeared. Take the vocabulary, leave the weight.

## Restoring it

Copy the files back over `web/src/app/home/` and `web/src/app/globals.css`, then
run the check suite. `scripts/contrast.test.ts` will confirm the palette still
reads, and `scripts/promises.test.ts` will confirm the page still claims only
what the catalogue can fill.
