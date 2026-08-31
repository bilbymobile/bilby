import 'package:flutter/material.dart';

/// Brand and design system, version 2.
///
/// The name is Bilby, an endangered Australian marsupial with outsized ears,
/// which gives the brand a mark that doubles as an antenna. It says nothing
/// about travel, so it carries into any future product unchanged.
///
/// The domain is bilbymobile.com. The app is "Bilby" everywhere a user sees
/// it; "Bilby Mobile" is only the domain and the legal trading name.
///
/// ## What changed in v2, and why
///
/// v1 was a competent dark theme. v2 is a position. It came out of a study of
/// Firsty, Airalo, Holafly, Trip.com, Hopper, Revolut, Wise and the 2026 Apple
/// Design Award winners, and it rests on six decisions:
///
///  1. **Four tonal surfaces, no shadows.** Depth comes from luminance steps.
///     This is how Revolut builds dark hierarchy and it is the difference
///     between a dark mode that reads as engineered and one that reads as an
///     inverted light theme.
///
///  2. **One loud accent, never two.** Firsty owns acid lime and Wise owns leaf
///     green, so [accent] takes the adjacent slot nobody has claimed. Every
///     additional brand colour weakens the meaning of the first one, which is
///     visible in Trip.com and increasingly in Revolut.
///
///  3. **A living graphite field behind everything.** Four blurred masses drift
///     on prime numbered cycles so they never resynchronise. See
///     `widgets/living_field.dart`.
///
///  4. **The balance is the hero object.** Set at [numeral] size, rolled per
///     digit, locked to tabular figures. Wise retuned the numerals in their own
///     typeface because a giant number is their hero; same principle here.
///
///  5. **One continuous touchable data object** in place of a progress bar.
///     A utility that can be dragged is what won design awards in 2026.
///
///  6. **Two springs and one curve.** Nothing else. See [Motion].
class Brand {
  static const name = 'Bilby';
  static const slug = 'bilby';
  static const tagline = 'Big ears. Full signal.';

  /// The customer brand apex. One string, every other host follows.
  ///
  /// `bilbymobile.com` is the brand and the settled name. The build time
  /// override exists because this string is frozen into every installed copy
  /// at compile time, and a hostname that can only be changed by editing
  /// source is a hostname that cannot be changed at all.
  /// Mirrors `web/src/lib/hosts.ts`.
  static const apex = String.fromEnvironment(
    'APEX',
    defaultValue: 'bilbymobile.com',
  );

  /// Backend origin, and the single most permanent string in this file.
  ///
  /// Whatever ships here is carried by every installed copy of the app for as
  /// long as that copy exists. Android users update slowly and a meaningful
  /// number never update at all, so this hostname has to keep answering long
  /// after the rest of the stack has been rebuilt twice. The iOS build will
  /// inherit the same name for the same reason.
  ///
  /// So it points at a name that serves nothing but the API. The apex is the
  /// marketing site, `app.` is the browser product, and `api.` exists purely so
  /// that moving either of those two is a deployment rather than a forced
  /// update that half the install base will never take.
  ///
  /// This origin is token authenticated and sets no cookies, which is what
  /// keeps the mobile surface immune to cross site request forgery.
  ///
  /// Overridden at build time with `--dart-define=API_BASE=...`; point it at
  /// `http://10.0.2.2:3000` for the Android emulator.
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://api.$apex',
  );

  /// The browser product. Anything this app hands off to a real browser, such
  /// as checkout, opens here rather than on [apiBase].
  ///
  /// Note the consequence, because it is not obvious: this is a different
  /// origin from [apiBase], so the browser starts with no session cookie from
  /// the app. A checkout link that carries no identity lands the payment on a
  /// fresh anonymous user, and the fix is a signed single use handoff token on
  /// the URL rather than a shared cookie domain.
  static const appBase = String.fromEnvironment(
    'APP_BASE',
    defaultValue: 'https://app.$apex',
  );

  /// The public site. Legal pages, and the marketing face.
  static const siteBase = String.fromEnvironment(
    'SITE_BASE',
    defaultValue: 'https://$apex',
  );

  /// Incident and network status. Linked from the support screen, and hosted
  /// apart from everything else so it survives the outage it is reporting.
  static const statusBase = String.fromEnvironment(
    'STATUS_BASE',
    defaultValue: 'https://status.$apex',
  );

  // ── Surfaces ─────────────────────────────────────────────────────────────
  // Four steps, each a luminance change. Nothing in the app casts a shadow.
  // Dark first is also a competitive position: no eSIM app on the store is,
  // and on an OLED handset it looks deeper and costs less battery.

  /// Canvas. The floor everything sits on.
  static const c0 = Color(0xFF07080B);

  /// Standard surface. Cards.
  static const c1 = Color(0xFF0F1216);

  /// Raised surface. Anything sitting on a card.
  static const c2 = Color(0xFF171B21);

  /// Control surface. Secondary buttons, chips, tracks.
  static const c3 = Color(0xFF20252C);

  static const line = Color(0x1AFFFFFF);
  static const line2 = Color(0x0FFFFFFF);

  static const text = Color(0xFFF5F7FA);
  static const text2 = Color(0xA3F5F7FA);
  static const text3 = Color(0x66F5F7FA);

  // ── Accent ───────────────────────────────────────────────────────────────

  /// Luminous aqua. Reads as signal and network rather than as money, which is
  /// the association this product wants and the one the category lacks.
  static const accent = Color(0xFF2BE8C8);

  /// Text and icons drawn ON the accent. Never white: white on aqua is 1.9 to 1
  /// and unreadable outdoors, which is where a travel app gets used.
  static const accentInk = Color(0xFF04241E);

  /// Deeper accent for gradient ends and pressed states.
  static const accentDeep = Color(0xFF17B9A0);

  static const warn = Color(0xFFFFB454);
  static const danger = Color(0xFFFF5C6E);

  // ── Radius ladder ────────────────────────────────────────────────────────
  // Nesting rule: a child radius equals its parent radius minus the inset
  // between them, so nested corners stay concentric instead of drifting apart.
  // A 28 radius card with 8 of padding gives 20 radius children.
  static const rSheet = 34.0;
  static const rHero = 28.0;
  static const rCard = 20.0;
  static const rChip = 16.0;

  /// Continuous curvature, not a circular arc.
  ///
  /// [ContinuousRectangleBorder] is the squircle Apple uses and it is the
  /// single cheapest upgrade available to perceived quality: it is most of the
  /// visual gap between a competent catalogue app and something that looks
  /// designed. Flutter's default [RoundedRectangleBorder] is a circular arc and
  /// reads slightly cheaper at every size.
  static ShapeBorder squircle(double r) =>
      ContinuousRectangleBorder(borderRadius: BorderRadius.circular(r * 1.6));

  /// The same curvature as a clip radius, for widgets that take a BorderRadius.
  /// The 1.6 factor approximates the superellipse Apple draws; without it a
  /// continuous border at the same nominal radius looks visibly tighter.
  static BorderRadius radius(double r) => BorderRadius.circular(r);

  // ── v1 names ─────────────────────────────────────────────────────────────
  // Kept so screens written against the old palette keep compiling while they
  // migrate one at a time. Every one of these maps to a v2 token rather than
  // holding its own value, so there is exactly one source of truth and the
  // aliases cannot drift. Delete them once nothing references them.
  static const bg = c0;
  static const surface = c1;
  static const surface2 = c2;
  static const border = line;
  static const muted = text2;
  static const accentDim = accentDeep;
}

/// Motion.
///
/// Two springs and one curve. That is the entire system, and the restriction is
/// the point: consistency of motion is what separates an app that feels
/// expensive from one that feels assembled, and inconsistency is invisible in
/// code review while being obvious in the hand.
///
/// The rules:
///  * Spatial change gets a spring. Things that move have mass.
///  * Opacity and colour get the curve. They are not spatial, so a spring on
///    them reads as a glitch.
///  * Never longer than 400ms on a primary interaction. Past that it stops
///    being polish and starts being latency.
///  * Everything is interruptible, and everything has a Reduce Motion path.
class Motion {
  /// Snappy spring. Taps, toggles, chips, sheet dismissal.
  static const snapDuration = Duration(milliseconds: 380);
  static const snap = Cubic(.22, 1.2, .36, 1);

  /// Gentle spring. Sheet presentation, card expansion, the balance odometer.
  static const gentleDuration = Duration(milliseconds: 560);
  static const gentle = Cubic(.16, 1.08, .3, 1);

  /// The one curve. Opacity and colour only.
  static const flatDuration = Duration(milliseconds: 180);
  static const flat = Cubic(.2, 0, 0, 1);

  /// Page transitions.
  static const page = Duration(milliseconds: 420);

  /// Stagger between items in a list entrance. Below about 40ms it reads as
  /// simultaneous; above about 90ms it reads as slow.
  static const stagger = Duration(milliseconds: 55);

  /// Per digit stagger in the odometer. Deliberately shorter than [stagger]:
  /// the digits belong to one number, so they should settle almost together.
  static const digitStagger = Duration(milliseconds: 26);

  /// Physics for the balance counter and meters.
  static const spring = SpringDescription(mass: 1, stiffness: 380, damping: 26);

  // ── v1 names ─────────────────────────────────────────────────────────────
  // Aliases onto the v2 system so existing screens keep compiling during the
  // migration. Note that `fast`, `base` and `slow` were three durations where
  // v2 has two springs and a curve: the reduction is the improvement, and
  // mapping them here rather than keeping their old values is what stops the
  // app from quietly running two motion systems at once.
  static const fast = snapDuration;
  static const base = flatDuration;
  static const slow = gentleDuration;
  static const enter = gentle;
  static const exit = flat;
  static const emphasised = snap;
}

/// Type scale.
///
/// Weight contrast is not fat against thin. It is enormous against small at
/// similar weights, which is the current look and what Revolut and Wise both
/// arrived at independently. The numeral carries the drama; the body stays calm.
class TypeScale {
  /// The hero number. Tabular figures are not optional: without them the digit
  /// advance changes as values roll and the whole number jitters.
  static const numeral = TextStyle(
    fontSize: 72,
    height: 1.0,
    fontWeight: FontWeight.w500,
    letterSpacing: -2.4,
    color: Brand.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const h1 = TextStyle(
    fontSize: 31,
    height: 1.08,
    fontWeight: FontWeight.w600,
    letterSpacing: -1.1,
    color: Brand.text,
  );

  static const h2 = TextStyle(
    fontSize: 19,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.4,
    color: Brand.text,
  );

  static const body = TextStyle(
    fontSize: 14.5,
    height: 1.55,
    color: Brand.text2,
  );

  static const tiny = TextStyle(
    fontSize: 12.5,
    height: 1.5,
    color: Brand.text3,
  );

  /// Section label. Uppercase, tracked out, quiet.
  static const eyebrow = TextStyle(
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: FontWeight.w700,
    color: Brand.text3,
  );
}
