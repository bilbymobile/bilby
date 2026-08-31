import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../brand.dart';
import '../services/ads_service.dart';
import '../widgets/animated_balance.dart';
import '../widgets/common.dart';
import '../widgets/reward_burst.dart';
import 'install_screen.dart';

/// The earn screen — the product.
///
/// The whole flow: tap → watch ad → wait for Google to tell our server → the
/// number goes up. Every design decision here serves the last step, because
/// that is the moment someone decides whether to watch a second ad.
///
/// The hard part is the wait. The reward is granted out-of-band by an SSV
/// callback that lands *after* the ad closes — usually within a second, but not
/// always. A naive implementation shows a finished ad and an unchanged balance,
/// and the user concludes they were cheated. So the pending state is explicit,
/// honest, and time-boxed.
class EarnScreen extends StatefulWidget {
  const EarnScreen({
    super.key,
    required this.api,
    required this.ads,
    this.onEditDestination,
    this.onNeedsDestination,
  });

  final ApiClient api;
  final AdsService ads;

  /// Opens the destination picker. Passed in rather than pushed from here so
  /// the shell owns the route and can rebuild this screen afterwards — every
  /// number below is derived from the destination.
  final Future<void> Function(String? current)? onEditDestination;

  /// Reports that the server still wants a destination chosen. The shell owns
  /// the first-run gate, but the gate can be bypassed (a failed cold start
  /// followed by "continue offline"), and this screen is where the first real
  /// response arrives afterwards.
  final VoidCallback? onNeedsDestination;

  @override
  State<EarnScreen> createState() => _EarnScreenState();
}

class _EarnScreenState extends State<EarnScreen>
    with TickerProviderStateMixin {
  late final AnimationController _burst;
  late final AnimationController _entrance;

  Me? _me;
  Object? _error;
  bool _busy = false;
  String? _status;
  bool _statusIsError = false;

  @override
  void initState() {
    super.initState();
    _burst = AnimationController(vsync: this, duration: Motion.slow);
    _entrance = AnimationController(vsync: this, duration: Motion.page);
    _load().then((_) {
      // See destination_screen: _load() never rethrows, so this runs even if
      // the screen was disposed while the request was in flight.
      if (mounted) _entrance.forward();
    });
    unawaited(widget.ads.init());
  }

  @override
  void dispose() {
    _burst.dispose();
    _entrance.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final me = await widget.api.me();
      if (mounted) {
        setState(() {
          _me = me;
          _error = null;
        });
        if (me.needsDestination) widget.onNeedsDestination?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _status = 'Could not reach the server. Check your connection.';
          _statusIsError = true;
        });
      }
    }
  }

  Future<void> _watchAd() async {
    final me = _me;
    if (me == null) return;

    setState(() {
      _busy = true;
      _status = null;
      _statusIsError = false;
    });

    try {
      final result = await widget.ads.show(me.ssvUserId);

      switch (result) {
        case AdResult.dismissed:
          _say('You closed the ad early, so nothing was credited.', error: false);
          return;
        case AdResult.noFill:
          _say('No ad available right now. Try again in a moment.', error: false);
          return;
        case AdResult.error:
          _say('The ad could not be shown. Nothing was credited.', error: true);
          return;
        case AdResult.watched:
          break;
      }

      // Ad watched. Now wait for Google's callback to reach our server.
      _say('Confirming with the ad network…', error: false);
      final credited = await _pollForCredit(me.balanceMb);

      if (credited != null) {
        // Haptic first, then visuals. Firing them together feels late, because
        // touch registers faster than sight.
        unawaited(HapticFeedback.mediumImpact());
        // _pollForCredit can run for 12 seconds. Plenty of time for the user
        // to have left.
        if (mounted) _burst.forward(from: 0);
        _say('+${credited - me.balanceMb} MB', error: false);
      } else {
        _say(
          "The ad network hasn't confirmed yet. This usually lands within a "
          'minute, and your balance will update on its own.',
          error: false,
        );
      }
    } finally {
      await _load();
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Poll `/api/me` until the balance moves, with backoff and a hard stop.
  ///
  /// Returns the new balance, or null if the callback never arrived. Giving up
  /// and saying so is better than an indefinite spinner — a user who is told
  /// "it will land" waits; a user watching a spinner uninstalls.
  Future<int?> _pollForCredit(int before) async {
    final deadline = DateTime.now().add(const Duration(seconds: 12));
    var delay = const Duration(milliseconds: 400);

    while (DateTime.now().isBefore(deadline)) {
      await Future.delayed(delay);
      delay = Duration(
        milliseconds: (delay.inMilliseconds * 1.5).round().clamp(400, 2000),
      );
      try {
        final me = await widget.api.me();
        if (me.balanceMb > before) {
          if (mounted) setState(() => _me = me);
          return me.balanceMb;
        }
      } catch (_) {
        // Transient — keep polling until the deadline.
      }
    }
    return null;
  }

  Future<void> _redeem() async {
    setState(() => _busy = true);
    try {
      final r = await widget.api.redeem();
      if (r.ok) {
        unawaited(HapticFeedback.heavyImpact());
        _say(
          r.isNewProfile
              ? '${r.redeemedMb} MB loaded onto a new eSIM.'
              : '${r.redeemedMb} MB added to your eSIM. Nothing to reinstall.',
          error: false,
        );
        // Do not make them go and find it. This is the payoff moment after
        // days of watching ads, and every tap between here and an installed
        // profile drops users — the eSIM is worth nothing until it is on the
        // phone.
        if (r.isNewProfile && r.iccid != null && mounted) {
          await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => InstallScreen(api: widget.api, iccid: r.iccid!),
          ));
        }
      } else {
        _say(_explain(r.reason), error: true);
      }
    } finally {
      await _load();
      if (mounted) setState(() => _busy = false);
    }
  }

  void _say(String msg, {required bool error}) {
    if (!mounted) return;
    setState(() {
      _status = msg;
      _statusIsError = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final me = _me;

    // First launch with no network used to spin forever here: _status was only
    // rendered inside the ListView below, which never built while _me was null,
    // and the RefreshIndicator was in that same unbuilt branch. The only way out
    // was force-quitting. Airport wifi with a captive portal is the *modal*
    // first-run condition for a connectivity product, so this is the one screen
    // that had to handle it and didn't.
    if (me == null && _error != null) {
      return ErrorState(onRetry: _load, detail: _error.toString());
    }
    if (me == null) {
      return const Center(
        child: CircularProgressIndicator(color: Brand.accent, strokeWidth: 2),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: Brand.accent,
      backgroundColor: Brand.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          _stagger(0, _header()),
          const SizedBox(height: 16),
          _stagger(1, _destinationBar(me)),
          const SizedBox(height: 14),
          _stagger(2, _balanceCard(me)),
          const SizedBox(height: 14),
          _stagger(3, _actions(me)),
          if (_status != null) ...[
            const SizedBox(height: 14),
            _statusNote(),
          ],
          const SizedBox(height: 14),
          _stagger(4, _whyCard(me)),
        ],
      ),
    );
  }

  /// Destination, always visible, always one tap from changeable.
  ///
  /// It sits above the balance rather than buried in a settings screen because
  /// it is the single input that determines every number below it. A user who
  /// cannot see what they are being priced against, and cannot change it
  /// without hunting, will read a low grant as us being stingy rather than as
  /// them having picked Dubai.
  Widget _destinationBar(Me me) => Semantics(
        button: true,
        label: 'Destination: ${me.destinationName}. Tap to change.',
        child: GestureDetector(
          onTap: widget.onEditDestination == null
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  widget.onEditDestination!(me.destination);
                },
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              color: Brand.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Brand.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.place_outlined, size: 18, color: Brand.muted),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('EARNING FOR',
                          style: TextStyle(
                              fontSize: 9.5,
                              letterSpacing: 0.8,
                              fontWeight: FontWeight.w600,
                              color: Brand.muted)),
                      const SizedBox(height: 3),
                      Text(me.destinationName,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Brand.text)),
                    ],
                  ),
                ),
                const Text('Change',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Brand.accent)),
                const Icon(Icons.chevron_right, size: 18, color: Brand.accent),
              ],
            ),
          ),
        ),
      );

  /// Staggered entrance. Each child slides up and fades slightly after the one
  /// before it, which reads as the screen assembling rather than appearing.
  Widget _stagger(int index, Widget child) {
    final start = (index * 0.09).clamp(0.0, 0.7);
    // drive(CurveTween), not CurvedAnimation.
    //
    // CurvedAnimation's constructor registers a status listener on its parent
    // and only unregisters it in dispose(). This runs inside build(), five
    // times, on every setState — of which there are many (poll ticks, status
    // changes, busy toggles). Each rebuild would leak five more listeners onto
    // a controller that lives as long as the screen. drive() returns a plain
    // animation with no subscription at all.
    final end = (start + 0.55).clamp(0.0, 1.0);

    // Motion.enter overshoots past 1.0 on purpose: the control point sits at
    // 1.08, and that overshoot is exactly what makes the rise settle like a
    // physical object instead of stopping dead. Opacity asserts 0 <= o <= 1,
    // so the same value cannot legally drive both. This is the rule already
    // written at the top of Motion: spatial change gets a spring, opacity gets
    // the flat curve. It was stated and then not followed here.
    //
    // In release the assert is compiled out and the value is clamped, so this
    // failed only in debug and in every widget test that rendered this screen,
    // which is the sort of bug that survives a long time by being invisible in
    // the build people actually ship.
    final rise = _entrance.drive(
      CurveTween(curve: Interval(start, end, curve: Motion.enter)),
    );
    final fade = _entrance.drive(
      CurveTween(curve: Interval(start, end, curve: Motion.flat)),
    );
    return AnimatedBuilder(
      animation: _entrance,
      builder: (_, c) => Opacity(
        // Clamped as well as curved. Belt and braces: Motion.flat cannot
        // exceed 1, but a future curve swap here should degrade to a slightly
        // wrong fade rather than to a crash.
        opacity: fade.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, 18 * (1 - rise.value)),
          child: c,
        ),
      ),
      child: child,
    );
  }

  // Whole subtree is const: it never changes, so Flutter can skip rebuilding
  // and re-diffing it entirely. Nested `const` keywords are redundant once the
  // parent is const — leaving them in trips unnecessary_const.
  Widget _header() => const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            Brand.tagline,
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.9,
              color: Brand.text,
              height: 1.1,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Watch a short ad, get data on your eSIM. Pay only on the days you '
            'want full speed.',
            style: TextStyle(fontSize: 15, color: Brand.muted, height: 1.5),
          ),
        ],
      );

  Widget _balanceCard(Me me) => _card(
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Burst sits behind the content so particles read as coming from
            // the number rather than covering it.
            Positioned.fill(child: RewardBurst(controller: _burst)),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Your balance',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Brand.text)),
                    // Names the DESTINATION, not the current location. Those
                    // used to be the same value; conflating them is what told
                    // pre-departure users their country was unsupported.
                    _pill('${me.mbPerAd} MB per ad · ${me.destinationName}'),
                  ],
                ),
                const SizedBox(height: 16),
                AnimatedBalance(valueMb: me.balanceMb),
                const SizedBox(height: 18),
                _meter(me.redemptionProgress),
                const SizedBox(height: 10),
                Text(
                  me.canRedeem
                      ? 'Ready to load onto your eSIM.'
                      : '${me.redemptionThresholdMb - me.balanceMb} MB to go before you can load it onto an eSIM.',
                  style: const TextStyle(fontSize: 13, color: Brand.muted),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    _stat('Ads left today',
                        '${me.adsRemainingToday}/${me.dailyAdCap}'),
                    const SizedBox(width: 26),
                    _stat('Max today', '${me.mbPerAd * me.dailyAdCap} MB'),
                  ],
                ),
              ],
            ),
          ],
        ),
      );

  /// Progress meter. Animates to its target rather than jumping, so a credit
  /// visibly pushes it forward.
  Widget _meter(double progress) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: progress),
        duration: Motion.slow,
        curve: Motion.enter,
        builder: (_, v, __) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: Stack(
            children: [
              Container(height: 8, color: Brand.surface2),
              FractionallySizedBox(
                widthFactor: v.clamp(0.0, 1.0),
                child: Container(
                  height: 8,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Brand.accentDim, Brand.accent],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _actions(Me me) {
    final canWatch =
        !_busy && me.adsRemainingToday > 0 && me.freeTierAvailable;
    return Row(
      children: [
        Expanded(
          flex: 3,
          child: _button(
            // The label must explain its own disabled state. It used to read
            // "Watch ad · earn 8 MB" while being inert whenever
            // freeTierAvailable was false, which reads as a broken button
            // rather than a closed door — and the explanatory card below keyed
            // off different fields, so in some combinations nothing on screen
            // said why.
            // Cap first, deliberately. If the server ever folds
            // `adsRemainingToday > 0` into `freeTierAvailable` — which is the
            // natural reading of "is the free tier available to you right now"
            // — then checking availability first would show "Free data
            // unavailable" to every engaged user the moment they finish their
            // tenth ad. That is a daily insult to the best users. "Back
            // tomorrow" is both more specific and more accurate.
            label: me.adsRemainingToday == 0
                ? 'Back tomorrow'
                : !me.freeTierAvailable
                    ? 'Free data unavailable'
                    : 'Watch ad · earn ${me.mbPerAd} MB',
            onTap: canWatch ? _watchAd : null,
            primary: true,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 2,
          child: _button(
            label: 'Load onto eSIM',
            onTap: (!_busy && me.canRedeem) ? _redeem : null,
            primary: false,
          ),
        ),
      ],
    );
  }

  /// Button with a press-scale. A 40ms scale to 0.97 on touch-down is the
  /// cheapest possible upgrade to perceived quality — the control acknowledges
  /// you before the network does.
  Widget _button({
    required String label,
    required VoidCallback? onTap,
    required bool primary,
  }) {
    final enabled = onTap != null;
    return _PressScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.fast,
        padding: const EdgeInsets.symmetric(vertical: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: primary
              ? Brand.accent.withValues(alpha: enabled ? 1 : 0.35)
              : Brand.surface2,
          borderRadius: BorderRadius.circular(12),
          border: primary ? null : Border.all(color: Brand.border),
        ),
        child: _busy && primary
            ? const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Color(0xFF04120C)),
              )
            : Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: primary
                      ? const Color(0xFF04120C)
                      : (enabled ? Brand.text : Brand.muted),
                ),
              ),
      ),
    );
  }

  Widget _statusNote() => AnimatedSwitcher(
        duration: Motion.base,
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: SizeTransition(sizeFactor: anim, child: child),
        ),
        // Same shape as the shared Note widget, and for the same reason: a
        // one-sided Border plus a borderRadius throws inside Border.paint.
        // See widgets/common.dart.
        child: Note(
          _status!,
          key: ValueKey(_status),
          tone: _statusIsError ? NoteTone.bad : NoteTone.good,
        ),
      );

  Widget _whyCard(Me me) => _card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Why the number changes',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Brand.text)),
            const SizedBox(height: 8),
            Text(
              'Data costs us more in some countries than others, and ads are '
              'worth more in some than others. So we work out what one ad can '
              'actually pay for where you are going. Right now that is '
              '${me.mbPerAd} MB for ${me.destinationName}.',
              style: const TextStyle(fontSize: 14, color: Brand.muted, height: 1.5),
            ),
            // The at-home premium, stated plainly and only when it is real.
            //
            // Worth saying out loud because it is counter-intuitive and it is
            // in the user's favour: ads shown here at home are worth more than
            // ads shown to the same person on a foreign network, so earning
            // before departure buys more data. For a handful of destinations
            // — the US among them — it runs the other way, which is why this
            // compares the two numbers instead of asserting a rule.
            if (me.atHome && me.atHomeMbPerAd > me.onArrivalMbPerAd) ...[
              const SizedBox(height: 12),
              Text(
                "You're earning at home rates: ${me.atHomeMbPerAd} MB per ad "
                'now, against ${me.onArrivalMbPerAd} MB once you land. Stock up '
                'before you fly, and install the eSIM while you still have '
                'WiFi, because you will not have any when you get off the '
                'plane.',
                style: const TextStyle(
                    fontSize: 14, color: Color(0xFFC9F5E5), height: 1.5),
              ),
            ] else if (me.atHome && me.onArrivalMbPerAd > me.atHomeMbPerAd) ...[
              const SizedBox(height: 12),
              Text(
                'Ads are worth more in ${me.destinationName} than they are '
                'here, so you will earn faster once you arrive: '
                '${me.onArrivalMbPerAd} MB per ad against ${me.atHomeMbPerAd} '
                'now. Still worth installing the eSIM before you go.',
                style: const TextStyle(
                    fontSize: 14, color: Brand.muted, height: 1.5),
              ),
            ],
            // Not an else-if chain, and not fully independent either.
            //
            // The original chain let a permanent property of the destination
            // (bank-before-you-fly) silently suppress a transient one (the
            // global pool being spent), so the button went dead with nothing on
            // screen explaining it. But making all four independent introduced
            // the opposite fault: "free data only works if you earn it before
            // you go" could render directly above "free data is not offered
            // here", which is a flat contradiction.
            //
            // So: "not offered at all" dominates, because it subsumes every
            // other reason. Below it, the remaining conditions are genuinely
            // independent and may legitimately stack.
            if (!me.regionSupported)
              _reason(
                'Free data is not offered for ${me.destinationName}. An ad '
                'earns less than a usable amount of data there costs. We would '
                'rather say so than hand you 2 MB and call it free. Paid plans '
                'work normally.',
              )
            else ...[
              if (me.bankBeforeYouFly && me.atHome)
                _reason(
                  'Worth knowing: free data for ${me.destinationName} only '
                  'works if you earn it before you go. Ad rates there cannot '
                  'fund a useful grant on their own, so whatever you bank now '
                  'is what you land with.',
                ),
              if (me.budgetExhausted)
                _reason(
                  "Today's free data pool is used up. That's our daily limit, "
                  'not yours, and it refills at midnight UTC. Your balance is '
                  'safe and paid plans are unaffected.',
                ),
              // Backstop: the button is off and nothing above explained why.
              // Excludes the spent-cap case, which the button label already
              // states more kindly as "Back tomorrow".
              if (!me.freeTierAvailable &&
                  !me.budgetExhausted &&
                  me.adsRemainingToday > 0)
                _reason(
                  "Earning is paused for ${me.destinationName} right now. Your "
                  'balance is safe, and paid plans are unaffected.',
                ),
            ],
          ],
        ),
      );

  /// One reason the free tier is not currently earning. Several can stack.
  Widget _reason(String text) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Text(
          text,
          style: const TextStyle(fontSize: 14, color: Brand.warn, height: 1.5),
        ),
      );

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Brand.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Brand.border),
        ),
        child: child,
      );

  Widget _pill(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Brand.accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(text,
            style: const TextStyle(
                fontSize: 11.5, fontWeight: FontWeight.w600, color: Brand.accent)),
      );

  Widget _stat(String k, String v) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(k.toUpperCase(),
              style: const TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w600,
                  color: Brand.muted)),
          const SizedBox(height: 4),
          Text(v,
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w600, color: Brand.text)),
        ],
      );

  static String _explain(String? reason) => switch (reason) {
        'below_threshold' => 'Earn a little more before loading it onto an eSIM.',
        'temporarily_unavailable' =>
          "We can't provision right now. Your credits are safe — try again shortly.",
        'no_fundable_plan' =>
          'No data packet small enough to match your balance. Earn a bit more.',
        _ => 'Something went wrong. Your balance is unchanged.',
      };
}

/// Scales its child down slightly while pressed.
class _PressScale extends StatefulWidget {
  const _PressScale({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTap: widget.onTap == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: Motion.fast,
        curve: Motion.enter,
        child: widget.child,
      ),
    );
  }
}
