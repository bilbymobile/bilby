import 'package:flutter/cupertino.dart';   // CupertinoPageTransitionsBuilder
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api/client.dart';
import 'brand.dart';
import 'screens/destination_screen.dart';
import 'screens/esims_screen.dart';
import 'screens/plans_screen.dart';
import 'widgets/common.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Edge to edge is mandatory from Android 15; the old opt out is gone, and an
  // app that ignores it gets its content sliced by the system bars.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  // Dark icons, because the app is a single light theme. This was light icons
  // while the palette was dark; leaving it would have painted white status bar
  // glyphs onto a cream page, which is invisible rather than merely wrong.
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light, // iOS reads this one instead
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
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
  /// nothing — it throws rather than returning null. The symptom was nastier
  /// than a crash log: the throw happened inside the picker's own try/catch, so
  /// a successful save was reported to the user as "couldn't save that just
  /// now", and the picker was never popped.
  final _navKey = GlobalKey<NavigatorState>();

  /// Route name for the picker, so it can be popped BY IDENTITY rather than by
  /// position. A bare `pop()` closes whatever happens to be on top, and the
  /// save callback can arrive late: tap a destination on a slow connection,
  /// back out, open an eSIM, and the PUT completing would close the install
  /// screen out from under the user.
  static const _pickerRoute = 'destination-picker';

  int _tab = 0;

  // ── First run gate ────────────────────────────────────────────────────────
  // Resolved once at startup, above the tab shell, rather than inside a screen.
  // The bottom navigation must not exist during first run: a tab bar invites
  // people to wander off mid setup, and every tab is meaningless before a
  // destination is chosen.
  bool _booting = true;
  bool _needsDestination = false;
  Object? _bootError;

  /// Bumped when the destination changes, to force the shell to rebuild from
  /// scratch rather than leave a screen showing plans priced for the country
  /// the user just left.
  int _epoch = 0;

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
      // Cold start with no backend. Not a silent spinner: the whole app sitting
      // behind one request was a regression, so there is an explicit escape.
      setState(() {
        _bootError = e;
        _booting = false;
      });
    }
  }

  void _destinationChanged() {
    if (!mounted) return;
    setState(() {
      _epoch++;
      _needsDestination = false;
    });
    // popUntil rather than pop: a no op when the picker is not on the stack,
    // which covers both first run (where it is `home`, not a pushed route) and
    // a save that lands after the user has navigated elsewhere.
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
                    // A cold start failure must not be a locked door. Retry is
                    // the right default; "carry on" is the necessary escape,
                    // and My eSIMs stays readable with no network.
                    secondaryLabel: 'Continue offline',
                    // Clears the error only. It deliberately does NOT assert
                    // that a destination is set: we never got an answer, so
                    // claiming one would be a lie the app never re-checks, and
                    // a genuinely new user who tapped this would never see
                    // setup again.
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
      appBar: AppBar(
        backgroundColor: Brand.bg,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        centerTitle: false,
        title: const Text(
          Brand.name,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
            color: Brand.text,
          ),
        ),
        actions: [
          // The destination lived on the earn screen, which no longer exists.
          // It belongs here anyway: it is a property of the trip rather than of
          // any one tab, and it has to stay reachable from both.
          IconButton(
            tooltip: 'Where are you going',
            icon: const Icon(Icons.travel_explore_outlined, color: Brand.text),
            onPressed: () => _editDestination(null),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        bottom: false,
        child: IndexedStack(
          index: _tab,
          children: [
            PlansScreen(key: ValueKey('plans-$_epoch'), api: _api),
            // Keyed on the tab so switching back re-runs initState and the list
            // reflects a purchase made moments ago.
            EsimsScreen(key: ValueKey('esims-$_tab-$_epoch'), api: _api),
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
        indicatorColor: Brand.sand,
        // Material 3 hides labels for unselected destinations by default, which
        // measurably hurts discoverability on a two tab app.
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
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
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: Brand.bg,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.light,
        primary: Brand.accent,
        secondary: Brand.accentDeep,
        surface: Brand.surface,
        error: Brand.danger,
        onPrimary: Brand.accentInk,
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
