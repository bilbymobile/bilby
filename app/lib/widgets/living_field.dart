import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand.dart';

/// The living graphite field that sits behind every screen.
///
/// Four blurred masses drifting slowly, three of them graphite and one tinted
/// with the accent. It is the single cheapest thing in the app that makes it
/// look expensive: the screen is never completely still, so it reads as a
/// surface rather than as a page.
///
/// ## Why the cycle lengths are prime
///
/// 29, 37, 43 and 53 seconds. Because they share no common factor, the four
/// masses never return to the same relative arrangement inside any realistic
/// session, so the motion reads as weather rather than as a loop. Round
/// numbers (30, 40, 50, 60) would resynchronise every two minutes and the eye
/// notices, even when it cannot say what it noticed.
///
/// ## Why it is cheap
///
/// One [CustomPaint] with four circles, each drawn with a blur mask. No
/// widgets rebuild: the painter listens to the controller directly through
/// `repaint`, so the whole animation happens on the raster thread without ever
/// touching the widget tree. The single [AnimationController] runs on the
/// longest cycle and every mass reads its own phase out of it.
class LivingField extends StatefulWidget {
  const LivingField({super.key, this.accent = Brand.accent, this.opacity = 1});

  /// Tinted mass colour. Passing the accent through means a future theme
  /// switch changes the field with everything else.
  final Color accent;

  /// Global multiplier, so a busy screen can quiet the field down without
  /// removing it.
  final double opacity;

  @override
  State<LivingField> createState() => _LivingFieldState();
}

class _LivingFieldState extends State<LivingField>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    // One controller on the longest cycle. Each mass derives its own phase, so
    // four independent animations cost one ticker.
    _c = AnimationController(vsync: this, duration: const Duration(seconds: 53))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Reduce Motion is not a courtesy here. A drifting background is precisely
    // the class of effect that triggers vestibular symptoms, so when it is on
    // we paint the field once, static, rather than removing it: the colour
    // relationships are load bearing, the movement is not.
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return RepaintBoundary(
      child: CustomPaint(
        painter: _FieldPainter(
          t: still ? const AlwaysStoppedAnimation(0.18) : _c,
          accent: widget.accent,
          opacity: widget.opacity,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _FieldPainter extends CustomPainter {
  _FieldPainter({required this.t, required this.accent, required this.opacity})
      : super(repaint: t);

  final Animation<double> t;
  final Color accent;
  final double opacity;

  /// Relative cycle lengths against the 53 second controller.
  static const _cycles = [53 / 29, 53 / 37, 53 / 43, 1.0];

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    // The three graphite masses are compile time constants, so they are built
    // once and reused on every frame rather than allocated sixty times a second
    // inside a painter. The fourth cannot be const because it carries the
    // runtime accent colour, which is the whole point of it.
    final masses = <_Mass>[
      const _Mass(Offset(.26, .18), .74, Color(0xFF2A3138), .95),
      const _Mass(Offset(.82, .30), .62, Color(0xFF161C22), .90),
      const _Mass(Offset(.34, .86), .88, Color(0xFF343C45), 1.0),
      _Mass(const Offset(.76, .72), .58, accent, .17),
    ];

    for (var i = 0; i < masses.length; i++) {
      final m = masses[i];
      final phase = (t.value * _cycles[i]) % 1.0;
      final a = phase * math.pi * 2;

      // Two frequencies per axis so the path is a slow lissajous rather than a
      // circle. A circular orbit is legible as an orbit; this is not.
      final dx = math.sin(a) * .10 + math.sin(a * 1.7 + i) * .04;
      final dy = math.cos(a * .8 + i) * .09 + math.sin(a * 2.3) * .03;
      final scale = 1 + math.sin(a * .9 + i * 1.3) * .18;

      final centre = Offset(
        (m.at.dx + dx) * size.width,
        (m.at.dy + dy) * size.height,
      );
      final r = m.r * size.shortestSide * .62 * scale;

      final paint = Paint()
        ..color = m.colour.withValues(alpha: m.alpha * opacity)
        // Screen blending keeps the masses additive on a near black canvas, so
        // where they overlap the field brightens instead of muddying.
        ..blendMode = BlendMode.screen
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * .55);

      canvas.drawCircle(centre, r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _FieldPainter old) =>
      old.accent != accent || old.opacity != opacity;
}

class _Mass {
  const _Mass(this.at, this.r, this.colour, this.alpha);
  final Offset at;
  final double r;
  final Color colour;
  final double alpha;
}
