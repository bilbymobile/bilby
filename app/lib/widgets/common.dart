import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../brand.dart';

/// Shared surfaces. Small on purpose — a design system that grows faster than
/// the product ends up describing screens nobody built.

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = 20});
  final Widget child;
  final double padding;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: EdgeInsets.all(padding),
        decoration: BoxDecoration(
          color: Brand.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Brand.border),
        ),
        child: child,
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.8,
                color: Brand.text,
                height: 1.15,
              )),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(subtitle!,
                style: const TextStyle(
                    fontSize: 15, color: Brand.muted, height: 1.5)),
          ],
        ],
      );
}

/// Inline note. `tone` drives the accent stripe.
class Note extends StatelessWidget {
  const Note(this.text, {super.key, this.tone = NoteTone.neutral});
  final String text;
  final NoteTone tone;

  @override
  Widget build(BuildContext context) {
    final (colour, fg) = switch (tone) {
      NoteTone.good => (Brand.accent, const Color(0xFFC9F5E5)),
      NoteTone.warn => (Brand.warn, const Color(0xFFF0DCC0)),
      NoteTone.bad => (Brand.danger, const Color(0xFFF5CFCF)),
      NoteTone.neutral => (Brand.muted, Brand.muted),
    };
    // Built as a clipped Row rather than a BoxDecoration with a one-sided
    // Border, because that combination throws.
    //
    // `Border(left: ...)` is non-uniform — the other three sides are
    // BorderStyle.none — and Border.paint asserts that a borderRadius is only
    // given on a uniform border. In a debug build that is a red screen on every
    // route containing a Note: Plans, Install, and the destination picker. In a
    // release build the assert is compiled out and the border simply does not
    // paint, so it fails loudly in development and silently in production,
    // which is the worst pairing available.
    //
    // ClipRRect + a 2px Container gives the identical result with no assert.
    return ClipRRect(
      borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
      child: ColoredBox(
        color: colour.withValues(alpha: 0.07),
        // Stretches the accent bar to whatever height the text wraps to.
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 2, color: colour),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                  child: Text(text,
                      style: TextStyle(fontSize: 14, height: 1.45, color: fg)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum NoteTone { neutral, good, warn, bad }

/// Failure state with a retry.
///
/// Worth more care than usual here: this is a *connectivity* product, so the
/// most likely reason a screen fails is the exact problem the product exists
/// to solve. A blank screen or a raw exception at that moment is the worst
/// possible first impression, so the copy names the situation plainly and the
/// retry is always one tap away.
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.onRetry,
    this.detail,
    this.secondaryLabel,
    this.onSecondary,
  });
  final VoidCallback onRetry;
  final String? detail;

  /// Optional escape hatch. Used by the cold-start gate so a failed first
  /// request cannot lock the user out of the whole app — retry is the right
  /// default, but it must not be the only door.
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, color: Brand.muted, size: 40),
              const SizedBox(height: 16),
              const Text(
                "Can't reach us right now",
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600, color: Brand.text),
              ),
              const SizedBox(height: 8),
              const Text(
                'Check your connection and try again. Any eSIM you have already '
                'installed keeps working without the app.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Brand.muted, height: 1.5),
              ),
              if (detail != null) ...[
                const SizedBox(height: 12),
                // Brand.muted, not Brand.border. This line was #1E2833 on
                // #07090D — a contrast ratio of 1.33:1, which is invisible.
                // It is diagnostic text on the screen a stressed user reaches
                // when something is already wrong; unreadable is the one thing
                // it must not be.
                Text(detail!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11.5, color: Brand.muted)),
              ],
              const SizedBox(height: 22),
              PrimaryButton(label: 'Try again', onTap: onRetry),
              if (secondaryLabel != null && onSecondary != null) ...[
                const SizedBox(height: 6),
                TextButton(
                  onPressed: onSecondary,
                  child: Text(secondaryLabel!,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Brand.muted)),
                ),
              ],
            ],
          ),
        ),
      );
}

class Loading extends StatelessWidget {
  const Loading({super.key});
  @override
  Widget build(BuildContext context) => const Center(
      child: CircularProgressIndicator(color: Brand.accent, strokeWidth: 2));
}

/// Button with a press-scale and a selection haptic.
///
/// The 140ms scale to 0.97 on touch-down is the cheapest available upgrade to
/// perceived quality: the control acknowledges you before the network does.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onTap,
    this.primary = true,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onTap;
  final bool primary;
  final bool busy;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null && !widget.busy;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTap: enabled
          ? () {
              HapticFeedback.selectionClick();
              widget.onTap!();
            }
          : null,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: Motion.fast,
        curve: Motion.enter,
        child: AnimatedContainer(
          duration: Motion.fast,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: widget.primary
                ? Brand.accent.withValues(alpha: enabled ? 1 : 0.35)
                : Brand.surface2,
            borderRadius: BorderRadius.circular(12),
            border: widget.primary ? null : Border.all(color: Brand.border),
          ),
          child: widget.busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Color(0xFF04120C)))
              : Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: widget.primary
                        ? const Color(0xFF04120C)
                        : (enabled ? Brand.text : Brand.muted),
                  ),
                ),
        ),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.highlight = false});
  final String text;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: highlight
              ? Brand.accent.withValues(alpha: 0.13)
              : Brand.surface2,
          borderRadius: BorderRadius.circular(99),
          border: highlight ? null : Border.all(color: Brand.border),
        ),
        child: Text(text,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
              color: highlight ? Brand.accent : Brand.muted,
            )),
      );
}
