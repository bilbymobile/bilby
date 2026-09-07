# Landing page v1, archived 7 September 2026

A frozen copy of the marketing landing page and the shared stylesheet as they
stood the day before the redesign began. Nothing here is imported by the
application. It exists so a decision can be reversed, or so a piece of it can be
lifted back, without reading a diff of a diff.

Commit at the time of archiving: `b708da1`.

## What this version was

Cream ground, deep navy ink, sand and clay from the Australian interior, one
teal reserved for "this is fine" and a pale sky blue reserved for signal. No
dark mode, deliberately: the hero render is lit at golden hour and an inversion
would fight the photograph rather than serve it.

The hero was a 3D rendered bilby above the Earth over Australia, bleeding off
the right edge, with four layers of ambient motion on prime cycles so they never
resynchronise into a visible pulse: a 17 second drift on the image, a 13 second
bloom over the light source, a signal emitting from the antenna, and dust on a
canvas.

The headline rose from behind a mask, line by line, rather than fading in.

## Why it is being replaced

Not because it was badly made. The reasons are commercial and were established
by looking at what the category actually does:

- Every one of eight competitors studied (Airalo, Holafly, Saily, Nomad, Ubigi,
  GigSky, aloSIM, Firsty) opens with function rather than with brand. The near
  universal first interaction is "where are you going". A rendered character
  above the Earth is a brand film, and a shop that opens with a brand film asks
  the visitor to wait before it answers the only question they arrived with.
- The one brand in that set with a price in the hero, aloSIM, has the clearest
  proposition of the eight.
- Per gigabyte pricing is absent almost everywhere in the category. It is the
  largest unclaimed advantage available and it belongs near the top.

The mascot is not being discarded. It moves from centrepiece to system
character: empty states, the install walkthrough, the support page, the app
icon. That is a promotion in usefulness even though it is a demotion in size.

## What is worth keeping from it

- **The palette.** It is the only warm ground in the category and it now runs
  across the marketing site, the shop, the legal pages and the console.
- **The honesty.** "No prices yet, because we will not guess at them" and the
  field notes section are a real differentiator in a category where every brand
  claims 24/7 support and none of them substantiates it.
- **The motion discipline.** No animation library, every effect reduced motion
  aware, and the whole dust loop stops when the hero leaves the viewport.
- **The rule learned the hard way**, which is written into `motion-gate.tsx` and
  must survive any redesign: motion may never be the thing that makes content
  visible. Chrome does not start the document timeline until a tab has been
  visible once, so an entrance animation in a background tab holds its element
  at the first keyframe forever. This page shipped with that defect and it made
  the hero invisible to anyone who opened it in a background tab.

## Files

| File | What it is |
|---|---|
| `page.tsx` | The whole landing page, one file |
| `home.module.css` | Its styles, scoped |
| `motion.tsx` | Parallax, dust canvas, scroll reveal. No library |
| `motion-gate.tsx` | The inline script that decides whether anything may hide |
| `nav.tsx`, `footer.tsx`, `shell.tsx` | Marketing chrome |
| `mark.tsx` | The wordmark |
| `notes.tsx` | Field notes section |
| `globals.css` | The shared token system, for reference |

The hero image is not copied here. It is `web/public/hero-bilby.jpg` and is
unchanged by the redesign.
