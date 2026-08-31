import 'package:flutter/material.dart';

import '../brand.dart';

/// The balance, rolled like an odometer.
///
/// Every digit is its own scrolling column, and each one starts 26ms after the
/// one to its left. The number arrives as a counter settling rather than as a
/// text swap, and that difference is most of what makes a balance feel like it
/// belongs to you.
///
/// ## Two details that are doing all the work
///
/// **Tabular figures.** [TypeScale.numeral] locks `FontFeature.tabularFigures`, so
/// every digit has the same advance width. Without it a 1 is narrower than a 0,
/// the number reflows as it rolls, and the whole thing wobbles. This is the
/// same reason Wise retuned the numerals in their own typeface: when a giant
/// number is the hero object, its metrics stop being typography and start being
/// engineering.
///
/// **Rolling the short way.** Going from 9 to 0 rolls forward through the strip
/// rather than backward through eight digits, because the column holds a
/// repeated 0 to 9 and we advance to the next occurrence. A balance that ticks
/// backward when it went up is a small lie about direction that people feel
/// without being able to name.
class Odometer extends StatefulWidget {
  const Odometer({
    super.key,
    required this.value,
    this.style,
    this.unit,
  });

  final int value;

  /// Defaults to [TypeScale.numeral]. Must keep tabular figures on.
  final TextStyle? style;

  /// Rendered small and baseline aligned beside the number, never inside it.
  final String? unit;

  @override
  State<Odometer> createState() => _OdometerState();
}

class _OdometerState extends State<Odometer> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late List<int> _from;
  late List<int> _to;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: Motion.gentleDuration)
      ..value = 1;
    _to = _digits(widget.value);
    _from = List.of(_to);
  }

  @override
  void didUpdateWidget(covariant Odometer old) {
    super.didUpdateWidget(old);
    if (old.value == widget.value) return;

    final next = _digits(widget.value);

    // The digit count changed (9 to 10, or 100 back to 99). Interpolating
    // between different column counts produces a visible shuffle, so we snap:
    // the layout change is the event, not the roll.
    if (next.length != _to.length) {
      setState(() {
        _from = next;
        _to = next;
        _c.value = 1;
      });
      return;
    }

    setState(() {
      _from = _to;
      _to = next;
    });
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  static List<int> _digits(int v) =>
      v.abs().toString().split('').map(int.parse).toList();

  @override
  Widget build(BuildContext context) {
    final style = widget.style ?? TypeScale.numeral;
    final h = (style.fontSize ?? 72) * (style.height ?? 1.0);

    // Digit advance for tabular figures sits close to 0.58em across the
    // grotesks we use. Measured rather than assumed would be better, and is
    // worth doing the day a custom face lands.
    final w = (style.fontSize ?? 72) * .58;

    final n = _to.length;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < n; i++)
          _Column(
            controller: _c,
            index: i,
            count: n,
            from: _from[i],
            to: _to[i],
            width: w,
            height: h,
            style: style,
          ),
        if (widget.unit != null) ...[
          SizedBox(width: h * .13),
          Padding(
            // Baseline aligned to the cap height of the numeral, not to its
            // descender box, which is why this is a nudge rather than zero.
            padding: EdgeInsets.only(bottom: h * .19),
            child: Text(
              widget.unit!,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Brand.text2,
                letterSpacing: .2,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Column extends StatelessWidget {
  const _Column({
    required this.controller,
    required this.index,
    required this.count,
    required this.from,
    required this.to,
    required this.width,
    required this.height,
    required this.style,
  });

  final Animation<double> controller;
  final int index, count, from, to;
  final double width, height;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    // Leftmost digit leads. The stagger is expressed as an Interval over the
    // shared controller rather than as separate delayed controllers, so the
    // whole number is one animation that can be interrupted as a unit.
    final total = Motion.gentleDuration.inMilliseconds;
    final delay = (Motion.digitStagger.inMilliseconds * index) / total;
    final begin = delay.clamp(0.0, .6);

    final curve = CurvedAnimation(
      parent: controller,
      curve: Interval(begin, 1.0, curve: Motion.gentle),
    );

    // Roll forward only. If the digit decreased we travel up through 10 rather
    // than back down, so an increasing balance never appears to tick backward.
    final distance = to >= from ? to - from : (10 - from) + to;

    return SizedBox(
      width: width,
      height: height,
      child: ClipRect(
        child: AnimatedBuilder(
          animation: curve,
          builder: (_, __) {
            final offset = (from + distance * curve.value) % 10;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                for (var d = 0; d < 12; d++)
                  Positioned(
                    top: (d - offset) * height,
                    left: 0,
                    right: 0,
                    child: SizedBox(
                      height: height,
                      child: Center(
                        child: Text('${d % 10}', style: style),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
