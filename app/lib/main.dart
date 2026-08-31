import 'package:flutter/cupertino.dart';   // CupertinoPageTransitionsBuilder
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api/client.dart';
import 'brand.dart';
import 'screens/destination_screen.dart';
import 'screens/earn_screen.dart';
import 'screens/esims_screen.dart';
import 'screens/plans_screen.dart';
import 'services/ads_service.dart';
import 'widgets/common.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Edge-to-edge is mandatory from Android 15 — the old opt-out is gone, and
  // an app that ignores it gets content sliced by the system bars.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  runApp(const App());
}

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  final _api = ApiClient();

  /// Needed because this State sits ABOVE the MaterialApp that owns the
  /// Navigator, so `Navigator.of(context)` here searches ancestors and finds
  /// nothing — it throws rather than returning null. The symptom is nastier
  /// than a crash log: the throw happens inside the picker's own try/catch, so
  /// a successful save was being reported to the user as "couldn't save that
  /// just now", and the picker was never popped.
  final _navKey = GlobalKey<NavigatorState>();

  /// Route name for the picker, so it can be popped BY IDENTITY rather than by
  /// position. A bare `pop()` closes whatever happens to be on top, and the
  /// save callback can now arrive late: tap a destination on a slow
  /// connection, back out, open an eSIM — and the PUT completing would have
  /// closed the install screen out from under the user.
  static const _pickerRoute = 'destination-picker';
  late final _ads = AdsService(
    // Compile-time override so a release build cannot accidentally ship the
    // test unit, and a debug build cannot accidentally hit production
    // inventory — which is how AdMob accounts get suspended for invalid
    // traffic. Pass with:
    //   flutter build appbundle --dart-define=ADMOB_REWARDED_ID=ca-app-pub-…
    rewardedAdUnitId: const String.fromEnvironment(
      'ADMOB_REWARDED_ID',
      defaultValue: AdsService.testRewardedUnit,
    ),
  );

  int _tab = 0;

  // ── First-run gate ────────────────────────────────────────────────────────
  // Resolved once at startup, above the tab shell, rather than inside the earn
  // screen. Two reasons it belongs here: the bottom navigation must not exist
  // during first run (a tab bar invites people to wander off mid-setup, and
  // every other tab is meaningless before a destination is chosen), and the
  // answer is a property of the session rather than of any one screen.
  bool _booting = true;
  bool _needsDestination = false;
  Object? _bootError;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    setState(() {
      _booting = true;
      _bootError = null;
    });
    try {
      final me = await _api.me();
      if (!mounted) return;
      setState(() {
        _needsDestination = me.needsDestination;
        _booting = false;
      });
    } catch (e) {
      if (!mounted) return;
      // Cold start with no network. Not a silent spinner — see the earn
      // screen's error state for why that failure mode mattered enough to fix
      // twice.
      setState(() {
        _bootError = e;
        _booting = false;
      });
    }
  }

  /// Bumped to force the earn screen to rebuild from scratch after the
  /// destination changes. Every number on that screen is derived from the
  /// destination, so a stale render would show the old exchange rate next to
  /// the new country name — the kind of small inconsistency that makes people
  /// stop believing the number.
  int _epoch = 0;

  void _destinationChanged() {
    if (!mounted) return;
    setState(() {
      _epoch++;
      _needsDestination = false;
    });
    // popUntil rather than pop: a no-op when the picker is not on the stack,
    // which covers both first run (where it is `home`, not a pushed route) and
    // a save that lands after the user has already navigated elsewhere.
    _navKey.currentState?.popUntil((r) => r.settings.name != _pickerRoute);
  }

  Future<void> _editDestination(String? current) async {
    final nav = _navKey.currentState;
    if (nav == null) return;
    await nav.push(
      MaterialPageRoute(
        settings: const RouteSettings(name: _pickerRoute),
        builder: (_) => DestinationScreen(
          api: _api,
          currentIso: current,
          firstRun: false,
          onChosen: _destinationChanged,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ads.dispose();
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: Brand.name,
      navigatorKey: _navKey,
      debugShowCheckedModeBanner: false,
      theme: _theme(),
      home: _booting
          ? const Scaffold(backgroundColor: Brand.bg, body: Loading())
          : _bootError != null
              ? Scaffold(
                  backgroundColor: Brand.bg,
                  body: ErrorState(
                    onRetry: _boot,
                    detail: _bootError.toString(),
                    // A cold-start failure must not be a locked door. Putting
                    // the whole app behind one request was a regression: before
                    // this gate existed each screen handled its own failure, so
                    // My eSIMs stayed reachable with no network. Retry is the
                    // right default; "carry on" is the necessary escape.
                    secondaryLabel: 'Continue offline',
                    // Clears the error only. It deliberately does NOT assert
                    // that the destination is set — we never got an answer, so
                    // claiming one would be a lie the app never re-checks, and
                    // a genuinely new user who tapped this would never see
                    // setup again. The earn screen reports back through
                    // onNeedsDestination the moment a real response lands.
                    onSecondary: () => setState(() => _bootError = null),
                  ),
                )
              : _needsDestination
                  ? DestinationScreen(api: _api, onChosen: _destinationChanged)
                  : _shell(),
    );
  }

  Widget _shell() {
    return Scaffold(
        backgroundColor: Brand.bg,
        body: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _tab,
            children: [
              EarnScreen(
                // Rebuilt from scratch when the destination changes, so no
                // number on screen can outlive the country it was priced for.
                key: ValueKey('earn-$_epoch'),
                api: _api,
                ads: _ads,
                onEditDestination: _editDestination,
                // Reasserts first-run setup if a later response says it is
                // still needed — the path that matters is "continue offline,
                // then regain signal".
                onNeedsDestination: () {
                  if (mounted && !_needsDestination) {
                    setState(() => _needsDestination = true);
                  }
                },
              ),
              PlansScreen(api: _api),
              // Keyed so switching tabs re-runs initState and the eSIM list
              // reflects a redemption made moments earlier on the Earn tab.
              EsimsScreen(key: ValueKey(_tab), api: _api),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) {
            HapticFeedback.selectionClick();
            setState(() => _tab = i);
          },
          backgroundColor: Brand.surface,
          indicatorColor: Brand.accent.withValues(alpha: 0.15),
          // Material 3's default label behaviour hides labels for unselected
          // destinations, which measurably hurts discoverability on a
          // three-tab app where two tabs are revenue.
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.bolt_outlined),
                selectedIcon: Icon(Icons.bolt),
                label: 'Earn'),
            NavigationDestination(
                icon: Icon(Icons.sim_card_outlined),
                selectedIcon: Icon(Icons.sim_card),
                label: 'Plans'),
            NavigationDestination(
                icon: Icon(Icons.travel_explore_outlined),
                selectedIcon: Icon(Icons.travel_explore),
                label: 'My eSIMs'),
          ],
        ),
    );
  }

  ThemeData _theme() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: Brand.bg,
      colorScheme: base.colorScheme.copyWith(
        primary: Brand.accent,
        secondary: Brand.accentDim,
        surface: Brand.surface,
        error: Brand.danger,
        onPrimary: const Color(0xFF04120C),
        onSurface: Brand.text,
      ),
      // Material's default page transition on Android is the platform zoom.
      // Fine, but it does not match the deliberate motion elsewhere, so the
      // whole app uses one shared feel.
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
      splashFactory: InkSparkle.splashFactory,
    );
  }
}

