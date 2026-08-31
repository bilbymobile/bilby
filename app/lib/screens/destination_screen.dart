import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../brand.dart';
import '../services/esim_service.dart';
import '../widgets/common.dart';

/// "Where are you heading?"
///
/// ## Why this screen exists
///
/// The app used to price every grant against wherever the handset was standing.
/// That is correct exactly once — after you have landed — and wrong for the
/// entire period that actually matters commercially.
///
/// A traveller downloads a travel app in the week before departure. They are at
/// home when they do it. Home, for our launch market, is Australia: the second
/// most expensive roaming region on earth, where the engine correctly refuses
/// to run a free tier at all. So the app greeted its most motivated users with
/// "free data is not available in your country" and they uninstalled — during
/// the only window in which they reliably have the Wi-Fi needed to download an
/// eSIM profile in the first place.
///
/// Asking one question fixes that, and pays for itself three more times:
///
///   * Earning at home is priced at the FULL home-market ad rate, with no
///     roaming-retention discount, because an Australian watching an Australian
///     ad on an Australian IP is not a hypothesis — it is just an Australian ad
///     impression. For most destinations that is roughly double the grant.
///   * It is the natural place to check eSIM compatibility, before anyone
///     spends a week earning toward a profile their handset cannot install.
///   * It is where a destination's caveats belong — China's routing, Pakistan's
///     handset support, the UAE's VoIP restrictions — surfaced before the
///     decision rather than discovered at an airport.
class DestinationScreen extends StatefulWidget {
  const DestinationScreen({
    super.key,
    required this.api,
    required this.onChosen,
    this.currentIso,
    this.firstRun = true,
  });

  final ApiClient api;

  /// Called after the destination has been persisted server-side.
  final VoidCallback onChosen;

  final String? currentIso;

  /// First run gets no back button and a fuller explanation. Re-entry from the
  /// earn screen is a quick edit and should feel like one.
  final bool firstRun;

  @override
  State<DestinationScreen> createState() => _DestinationScreenState();
}

class _DestinationScreenState extends State<DestinationScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrance;

  List<DestinationOption>? _options;
  Object? _error;
  String? _saving;
  EsimSupport _esimSupport = EsimSupport.unknown;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(vsync: this, duration: Motion.page);
    // Guarded: _load() swallows its own errors, so this callback always runs
    // — including after the user has backed out mid-request and dispose() has
    // already fired. forward() on a disposed controller asserts.
    _load().then((_) {
      if (mounted) _entrance.forward();
    });
    _checkEsim();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  Future<void> _checkEsim() async {
    final s = await EsimService.deviceSupport();
    if (mounted) setState(() => _esimSupport = s);
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final list = await widget.api.destinations();
      if (mounted) setState(() => _options = list);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _choose(DestinationOption d) async {
    // Optimistic UI is wrong here. This value changes the exchange rate, and
    // showing a new rate before the server has accepted it means a failed save
    // leaves the user looking at a number we will not honour.
    setState(() => _saving = d.iso);

    // Only the network call is inside the try. Wrapping the onChosen() callback
    // too meant any error thrown while navigating away — and there was one —
    // got caught here and reported as "couldn't save", after the save had
    // already succeeded. A catch block should cover the operation it names and
    // nothing else.
    try {
      await widget.api.setDestination(d.iso);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Brand.surface2,
          content: Text(
            "Couldn't save that just now. Check your connection and try again.",
            style: TextStyle(color: Brand.text),
          ),
        ),
      );
      return;
    }

    unawaited(HapticFeedback.mediumImpact());
    // NOT guarded on `mounted`. If the user backed out while the PUT was in
    // flight, the save still succeeded — swallowing the callback here would
    // leave the earn screen rendering the previous country's name, rate and
    // "MB to go" until a manual refresh, which is exactly the stale render the
    // epoch counter exists to prevent. `onChosen` belongs to the app shell,
    // which does its own mounted check against its own State.
    widget.onChosen();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.bg,
      appBar: widget.firstRun
          ? null
          : AppBar(
              backgroundColor: Brand.bg,
              surfaceTintColor: Colors.transparent,
              foregroundColor: Brand.text,
              title: const Text('Change destination',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
            ),
      body: SafeArea(
        child: _error != null && _options == null
            ? ErrorState(onRetry: _load, detail: _error.toString())
            : _options == null
                ? const Loading()
                : _list(_options!),
      ),
    );
  }

  Widget _list(List<DestinationOption> options) {
    return ListView(
      padding: EdgeInsets.fromLTRB(20, widget.firstRun ? 32 : 4, 20, 40),
      children: [
        if (widget.firstRun) ...[
          const Text(
            'Where are you\nheading?',
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.9,
              height: 1.1,
              color: Brand.text,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'We price a free ad against where you will be using the data, not '
            'where you are standing now. Pick a destination and we will show '
            'you exactly what one ad is worth there.',
            style: TextStyle(fontSize: 15, color: Brand.muted, height: 1.5),
          ),
          const SizedBox(height: 18),
          _esimBanner(),
          const SizedBox(height: 18),
        ],
        ...List.generate(options.length, (i) => _row(options[i], i)),
        const SizedBox(height: 16),
        const Note(
          'You can change this any time from the Earn screen. Nothing is locked '
          'to where you first opened the app.',
        ),
      ],
    );
  }

  /// eSIM compatibility, checked before anyone invests a week of ad-watching.
  ///
  /// Deliberately not a blocking dialog. The check is a best-effort platform
  /// query and a false negative — an unusual OEM, a locked-down enterprise
  /// build — must not lock someone out of a product that would have worked. So
  /// an unsupported result informs and warns; it never bars the door.
  Widget _esimBanner() => switch (_esimSupport) {
        EsimSupport.supported => const Note(
            'This phone supports eSIM. We check first, so nobody spends a week '
            'earning toward a profile their handset cannot install.',
            tone: NoteTone.good,
          ),
        EsimSupport.unsupported => const Note(
            "We couldn't confirm this phone supports eSIM. You can still look "
            'around, but check your device settings for an "Add eSIM" option '
            'before you start earning — without it the data has nowhere to go.',
            tone: NoteTone.warn,
          ),
        EsimSupport.unknown => const SizedBox.shrink(),
      };

  Widget _row(DestinationOption d, int index) {
    final selected = d.iso == widget.currentIso;
    final busy = _saving == d.iso;
    final disabled = _saving != null && !busy;

    // Stagger the entrance, capped so a thirteen-item list does not take a
    // second and a half to finish arriving.
    final start = (index * 0.05).clamp(0.0, 0.6);
    // drive() rather than CurvedAnimation — see the note in earn_screen. This
    // list is thirteen rows, so the leak would be proportionally worse here.
    final end = (start + 0.4).clamp(0.0, 1.0);

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
      builder: (_, child) => Opacity(
        // Clamped as well as curved. Belt and braces: Motion.flat cannot
        // exceed 1, but a future curve swap here should degrade to a slightly
        // wrong fade rather than to a crash.
        opacity: fade.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - rise.value)),
          child: child,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Opacity(
          opacity: disabled ? 0.45 : 1,
          child: GestureDetector(
            onTap: disabled || busy ? null : () => _choose(d),
            child: AnimatedContainer(
              duration: Motion.fast,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: selected ? Brand.surface2 : Brand.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected ? Brand.accent : Brand.border,
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(d.flag, style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              d.name,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Brand.text,
                              ),
                            ),
                            if (d.blurb != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                d.blurb!,
                                style: const TextStyle(
                                    fontSize: 12.5,
                                    color: Brand.muted,
                                    height: 1.35),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      if (busy)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Brand.accent),
                        )
                      else
                        _rateBadge(d),
                    ],
                  ),
                  if (d.freeTierPossible && d.atHomeMb != d.onArrivalMb) ...[
                    const SizedBox(height: 12),
                    _rateComparison(d),
                  ],
                  if (d.caution != null) ...[
                    const SizedBox(height: 12),
                    // Shared Note rather than a bespoke box: it already solves
                    // the one-sided-border problem and already uses #F0DCC0 for
                    // the text instead of Brand.warn, which sits at 2.9:1 on a
                    // 7%-opacity warn wash and is unreadable in the sunlight
                    // this app actually gets used in.
                    Note(d.caution!, tone: NoteTone.warn),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _rateBadge(DestinationOption d) {
    if (!d.freeTierPossible) {
      return const Pill('Paid plans');
    }
    return Pill('${d.bestMb} MB / ad', highlight: true);
  }

  /// The two numbers, side by side.
  ///
  /// Both directions occur and the copy must not assume one. Earning at home
  /// beats arriving for most destinations, because Australian ad inventory is
  /// worth more than Southeast Asian inventory — but for the United States it
  /// is the other way round, since American eCPMs are higher than ours. An app
  /// that told every user to "stock up before you fly" would be wrong about the
  /// US, and being confidently wrong about a number the user can check is
  /// exactly how an honesty-positioned product loses its position.
  Widget _rateComparison(DestinationOption d) {
    final betterAtHome = d.atHomeMb > d.onArrivalMb;

    return Row(
      children: [
        Expanded(
          child: _leg(
            'Before you fly',
            d.freeTierAtHome ? '${d.atHomeMb} MB' : '—',
            emphasised: betterAtHome && d.freeTierAtHome,
          ),
        ),
        Container(width: 1, height: 30, color: Brand.border),
        Expanded(
          child: _leg(
            'After you land',
            d.freeTierOnArrival ? '${d.onArrivalMb} MB' : '—',
            emphasised: !betterAtHome && d.freeTierOnArrival,
          ),
        ),
      ],
    );
  }

  Widget _leg(String label, String value, {required bool emphasised}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9.5,
              letterSpacing: 0.7,
              fontWeight: FontWeight.w600,
              color: Brand.muted,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: emphasised ? Brand.accent : Brand.text,
            ),
          ),
        ],
      );
}
