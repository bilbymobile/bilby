# Bilby brand v3, the warm system

The landing page render sets the palette now. This is the same set of tokens
carried into the web app and the Flutter app so all three are one object.

Nothing here renames a token. Every existing name keeps its name and changes its
value, so both codebases keep compiling. What does break is listed at the end,
and it is short.

## The palette

| Role | Hex | Where it earns its place |
|---|---|---|
| Cream ground | `#F7EFE4` | Page and app canvas. The sky in the render. |
| Surface | `#FDF9F3` | Cards. One step up from the ground, not white. |
| Raised | `#F1E6D7` | Anything sitting on a card. |
| Control | `#EADCC9` | Chips, tracks, secondary fills. |
| Line | `#E7DAC8` | Hairlines. |
| Ink | `#0B2038` | All primary text, and the primary button fill. |
| Ink 2 | `#3A4C60` | Body copy. |
| Ink 3 | `#7C8B99` | Captions and labels. |
| Sand | `#EEBF8B` | The mascot's ears. Secondary action, and the only action colour that appears on a navy surface. |
| Sand ink | `#2A1A0B` | Text drawn on sand. |
| Clay | `#C87F45` | Warnings, and the field notes datestamp. |
| Teal | `#35857A` | Confirmation only. Ticks, "included", "activated". Never decoration. |
| Sky | `#5EA9CE` | Signal only. The wifi animation and nothing else. |
| Danger | `#B3402F` | Failures. |

Two rules make this hold together. **Teal means yes and sky means signal.**
The moment either one becomes a decorative accent the palette collapses into
generic warm minimalism, because ink and sand cannot carry meaning on their own.

## Typography

| Role | Face | Notes |
|---|---|---|
| Display | Outfit 500 / 600 | Headlines, numbers, buttons. Matches the render. |
| Body | Plus Jakarta Sans 400 / 500 | Running text. Warmer than Inter and not the default everyone uses. |
| Utility | IBM Plex Mono 400 / 500 | Eyebrows, country codes, ICCIDs, anything tabular. Carried over from v2 unchanged. |

## Web, drop into `web/src/app/globals.css`

```css
:root {
  --bg: #F7EFE4;
  --surface: #FDF9F3;
  --surface-2: #F1E6D7;
  --control: #EADCC9;
  --border: #E7DAC8;
  --text: #0B2038;
  --text-2: #3A4C60;
  --muted: #7C8B99;

  --accent: #0B2038;        /* primary action, was aqua */
  --accent-dim: #1B3350;
  --accent-ink: #F7EFE4;    /* text drawn ON accent */

  --sand: #EEBF8B;
  --sand-ink: #2A1A0B;
  --clay: #C87F45;
  --positive: #35857A;
  --signal: #5EA9CE;
  --warn: #C87F45;
  --danger: #B3402F;

  --radius: 16px;
  --max: 1240px;
}
```

Then six edits in the same file, because the old aqua ink is hardcoded:

* `.btn` colour `#04120c` becomes `var(--accent-ink)`
* `.note.ok` becomes `border-color: var(--positive); background: rgba(53,133,122,.07); color: var(--text-2)`
* `.badge.free` becomes `background: rgba(53,133,122,.12); color: var(--positive)`
* `a` colour: navy on cream gives links no separation from body text, so links
  take `var(--positive)` with an underline, or stay ink and rely on underline alone
* `.balance .n` becomes `var(--text)`, since a giant number in the action colour
  now reads as a button
* `.meter > i` gradient becomes `linear-gradient(90deg, var(--sand), var(--clay))`

## Flutter, drop into the colour section of `app/lib/brand.dart`

```dart
  // ── Surfaces ─────────────────────────────────────────────────────────────
  // Four steps, warm, no shadows. Depth is luminance, same as v2. What changed
  // is the direction: the steps now go up from a cream ground rather than up
  // from black, so every elevation is lighter than the thing beneath it.

  static const c0 = Color(0xFFF7EFE4); // canvas
  static const c1 = Color(0xFFFDF9F3); // cards
  static const c2 = Color(0xFFF1E6D7); // raised
  static const c3 = Color(0xFFEADCC9); // controls

  static const line  = Color(0x1F0B2038);
  static const line2 = Color(0x0F0B2038);

  static const text  = Color(0xFF0B2038);
  static const text2 = Color(0xFF3A4C60);
  static const text3 = Color(0xFF7C8B99);

  // ── Accent ───────────────────────────────────────────────────────────────
  // The action colour is ink, not a hue. On a warm ground the darkest thing on
  // screen is the thing you press, which is why the render reads as premium
  // rather than as a startup landing page.

  static const accent     = Color(0xFF0B2038);
  static const accentInk  = Color(0xFFF7EFE4);
  static const accentDeep = Color(0xFF1B3350);

  /// Secondary action, and the only action colour legible on a navy card.
  static const sand    = Color(0xFFEEBF8B);
  static const sandInk = Color(0xFF2A1A0B);

  /// Confirmation only. Never decoration.
  static const positive = Color(0xFF35857A);

  /// Signal only. The connection animation and nothing else.
  static const signal = Color(0xFF5EA9CE);

  static const warn   = Color(0xFFC87F45);
  static const danger = Color(0xFFB3402F);
```

The v1 aliases at the bottom of the class need no change. They point at tokens,
not at values, which is exactly why they were written that way.

## What actually breaks

Six files, and only one of them needs thought.

**Five are mechanical.** `main.dart:256`, `plans_screen.dart:140` and `:218`,
`earn_screen.dart:544` and `:553`, and `common.dart:247` and `:255` all hardcode
`Color(0xFF04120C)`, the old ink for text on aqua. Every one becomes
`Brand.accentInk`. They should have been that from the start.

`common.dart:62` to `:64` hardcode the note tone pairs. They become:

```dart
  NoteTone.good => (Brand.positive, const Color(0xFF1F4B45)),
  NoteTone.warn => (Brand.warn,     const Color(0xFF5C3A1B)),
  NoteTone.bad  => (Brand.danger,   const Color(0xFF5A2117)),
```

`earn_screen.dart:611` uses `Color(0xFFC9F5E5)`, a pale aqua on dark. It becomes
`Brand.text2`.

**One needs a decision: `widgets/living_field.dart`.** It drifts four blurred
graphite masses behind everything, and graphite on cream is dirt. The three mass
colours become warm tints of the ground, around `0xFFF1E6D7`, `0xFFEFE3D2` and
`0xFFF6EEE2`, with the blur radius left alone. Worth looking at on a device
before committing, because a drifting field is much more visible on a light
ground than on black and may need its opacity halved or may simply want turning
off on the light theme.

## One thing the header comment now gets wrong

The class docstring argues for dark first partly on OLED battery and partly on
"no eSIM app on the store is dark". Neither survives this change, so the comment
should say what is now true: the app is warm and light because the person using
it is usually anxious and often outdoors, and a cream ground at high brightness
is easier to read in sunlight than a black one.
