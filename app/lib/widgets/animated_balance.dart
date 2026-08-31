import 'package:flutter/material.dart';
import '../brand.dart';

/// The balance counter.
///
/// This is the emotional centre of the product — the number that goes up when
/// you watch an ad — so it gets more care than a number usually deserves.
///
/// Three deliberate choices:
///
/// 1. **It counts, it doesn't cut.** A value that snaps from 24 to 32 is
///    information. A value that rolls up is a reward. Same data, completely
///    different feeling, and this is the moment the whole free tier is selling.
///
/// 2. **Tabular figures.** Without `FontFeature.tabularFigures` the digits
///    have different widths, so a counting animation makes the whole number
///    jitter horizontally. It looks broken and nobody can tell you why.
///
/// 3. **It scales as it counts.** A subtle swell peaking mid-animation, then
///    settling. Reads as the number "landing" rather than merely arriving.
class AnimatedBalance extends StatefulWidget {
  const AnimatedBalance({
    super.key,
    required this.valueMb,
    this.fontSize = 56,
  });

  final int valueMb;
  final double fontSize;

  @override
  State<AnimatedBalance> createState() => _AnimatedBalanceState();
}

class _AnimatedBalanceState extends State<AnimatedBalance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late Animation<double> _value;
  int _from = 0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: Motion.slow);
    _value = AlwaysStoppedAnimation(widget.valueMb.toDouble());
    _from = widget.valueMb;
  }

  @override
  void didUpdateWidget(covariant AnimatedBalance old) {
    super.didUpdateWidget(old);
    if (old.valueMb == widget.valueMb) return;

    _from = old.valueMb;
    _value = Tween<double>(
      begin: _from.toDouble(),
      end: widget.valueMb.toDouble(),
    ).animate(CurvedAnimation(parent: _c, curve: Motion.enter));
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        // Swell peaks at the midpoint and returns to rest. sin() over one half
        // period gives that shape in one line and needs no second controller.
        final t = _c.value;
        final swell = 1 + 0.055 * (t == 0 || t == 1 ? 0 : _halfSine(t));

        return Transform.scale(
          scale: swell,
          alignment: Alignment.bottomLeft,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _value.value.round().toString(),
                style: TextStyle(
                  fontSize: widget.fontSize,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -widget.fontSize * 0.04,
                  color: Brand.accent,
                  height: 1,
                  // Without this the counter jitters horizontally as digit
                  // widths change. The bug is invisible in a static mock.
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'MB',
                style: TextStyle(
                  fontSize: widget.fontSize * 0.34,
                  fontWeight: FontWeight.w600,
                  color: Brand.muted,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static double _halfSine(double t) {
    // 0 → 0, 0.5 → 1, 1 → 0
    return (t <= 0.5 ? t : 1 - t) * 2;
  }
}
