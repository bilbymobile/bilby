import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../brand.dart';

/// The reward moment.
///
/// Two expanding rings and a ring of particles, fired when data lands. It is
/// pure decoration and it is worth the code: this is the instant that has to
/// feel good enough that someone watches a second ad. Everything else in the
/// product is plumbing around this half-second.
///
/// Implementation notes that matter for smoothness:
///
///  * One [CustomPainter] with one controller. The naive version spawns a
///    widget per particle; at 40 particles that is 40 widgets rebuilding every
///    frame, and it drops frames on the mid-range Androids that make up most
///    of an emerging-market install base.
///  * Particle positions are computed from a seeded angle, not `Random()` per
///    frame — otherwise they jitter instead of travelling.
///  * `RepaintBoundary` in the parent keeps this off the main layer, so the
///    counter animating underneath does not force a full-tree repaint.
class RewardBurst extends StatefulWidget {
  const RewardBurst({super.key, required this.controller, this.particles = 26});

  /// Drive from the parent so the burst is synchronised with the counter.
  final AnimationController controller;
  final int particles;

  @override
  State<RewardBurst> createState() => _RewardBurstState();
}

class _RewardBurstState extends State<RewardBurst> {
  late final List<_Particle> _seeds;

  @override
  void initState() {
    super.initState();
    final rnd = math.Random(7); // fixed seed: identical every time, no jitter
    _seeds = List.generate(widget.particles, (i) {
      final base = (i / widget.particles) * math.pi * 2;
      return _Particle(
        // Even distribution plus a little scatter reads organic; pure random
        // clumps and looks like a bug.
        angle: base + (rnd.nextDouble() - 0.5) * 0.42,
        distance: 46 + rnd.nextDouble() * 78,
        size: 1.8 + rnd.nextDouble() * 3.0,
        delay: rnd.nextDouble() * 0.16,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: widget.controller,
        builder: (_, __) => CustomPaint(
          painter: _BurstPainter(widget.controller.value, _seeds),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _Particle {
  final double angle, distance, size, delay;
  const _Particle({
    required this.angle,
    required this.distance,
    required this.size,
    required this.delay,
  });
}

class _BurstPainter extends CustomPainter {
  _BurstPainter(this.t, this.seeds);

  final double t;
  final List<_Particle> seeds;

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || t >= 1) return;
    final centre = Offset(size.width / 2, size.height / 2);

    // Two rings, offset in time, so the burst has depth rather than reading as
    // a single flat pulse.
    for (final offset in [0.0, 0.18]) {
      final rt = ((t - offset) / (1 - offset)).clamp(0.0, 1.0);
      if (rt <= 0) continue;

      final eased = Curves.easeOutCubic.transform(rt);
      final radius = eased * size.shortestSide * 0.62;
      final alpha = (1 - rt) * (offset == 0 ? 0.5 : 0.32);

      canvas.drawCircle(
        centre,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4 * (1 - rt) + 0.6
          ..color = Brand.accent.withValues(alpha: alpha),
      );
    }

    for (final p in seeds) {
      final pt = ((t - p.delay) / (1 - p.delay)).clamp(0.0, 1.0);
      if (pt <= 0) continue;

      final eased = Curves.easeOutQuart.transform(pt);
      final d = eased * p.distance;
      final pos = centre + Offset(math.cos(p.angle) * d, math.sin(p.angle) * d);

      // Fade over the back half only — fading from frame one makes the burst
      // look weak and washed out.
      final alpha = pt < 0.45 ? 1.0 : 1 - ((pt - 0.45) / 0.55);

      canvas.drawCircle(
        pos,
        p.size * (1 - eased * 0.45),
        Paint()
          ..color = (p.size > 3.4 ? Brand.accent : Brand.accentDim)
              .withValues(alpha: alpha.clamp(0.0, 1.0)),
      );
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) => old.t != t;
}
