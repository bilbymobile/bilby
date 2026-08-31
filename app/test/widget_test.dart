// Replaces the stub `flutter create` generates, which referenced a `MyApp`
// class this project does not have — that was the last analyzer error.
//
// This is a real test rather than a smoke test, and it exercises the seam that
// matters most: `ApiClient` takes an injectable `http.Client`, so the whole app
// can be driven against canned responses with no backend, no network and no
// emulator. If you add one habit to this project, make it this one — the
// pricing and reward logic is where the money is, and it is all reachable from
// here.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bilby/api/client.dart';
import 'package:bilby/screens/earn_screen.dart';
import 'package:bilby/services/ads_service.dart';

/// A `/api/me` payload shaped exactly like the real endpoint returns.
Map<String, dynamic> meJson({
  int balanceMb = 24,
  int mbPerAd = 8,
  bool freeTier = true,
  bool regionSupported = true,
  bool budgetExhausted = false,
  String destination = 'GB',
  String destinationName = 'United Kingdom',
}) =>
    {
      'ssvUserId': 'test-user.signature',
      'country': 'GB',
      'homeCountry': 'AU',
      'destination': destination,
      'destinationName': destinationName,
      'needsDestination': false,
      'atHome': false,
      'atHomeMbPerAd': 9,
      'onArrivalMbPerAd': mbPerAd,
      'bankBeforeYouFly': false,
      'regionSupported': regionSupported,
      'balanceMb': balanceMb,
      'mbPerAd': mbPerAd,
      'naiveMbPerAd': mbPerAd,
      'adsWatchedToday': 3,
      'dailyAdCap': 10,
      'adsRemainingToday': 7,
      'redemptionThresholdMb': 50,
      'canRedeem': balanceMb >= 50,
      'freeTierAvailable': freeTier,
      'budgetExhausted': budgetExhausted,
      'esims': <dynamic>[],
    };

ApiClient clientReturning(Map<String, dynamic> payload) => ApiClient(
      baseUrl: 'https://test.invalid',
      inner: MockClient((req) async => http.Response(
            jsonEncode(payload),
            200,
            headers: {'content-type': 'application/json'},
          )),
    );

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ApiClient reads its session cookie from SharedPreferences BEFORE it touches
  // the injected http client, so without this every test below would get a
  // MissingPluginException, fall into the error branch, and render the
  // full-screen ErrorState instead of the earn screen — quietly asserting
  // nothing. Per-test, because setMockInitialValues also resets the cached
  // instance.
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  // AdsService.init() fails soft when the platform channel is absent, which is
  // exactly the case in a widget test — so no mocking of the ads SDK is needed.
  final ads = AdsService(rewardedAdUnitId: AdsService.testRewardedUnit);

  testWidgets('shows a spinner before the first response lands',
      (tester) async {
    await tester.pumpWidget(
      wrap(EarnScreen(api: clientReturning(meJson()), ads: ads)),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders the balance and the per-ad grant', (tester) async {
    await tester.pumpWidget(
      wrap(EarnScreen(api: clientReturning(meJson()), ads: ads)),
    );
    await tester.pumpAndSettle();

    expect(find.text('24'), findsOneWidget);
    expect(find.text('MB'), findsOneWidget);
    // The grant rate is destination-dependent and shown up front on purpose.
    // Note it names the DESTINATION, not the current location — conflating
    // those is what told pre-departure users their country was unsupported.
    expect(find.textContaining('8 MB per ad'), findsOneWidget);
    expect(find.textContaining('United Kingdom'), findsWidgets);
  });

  testWidgets('tells the user plainly when the destination is not served',
      (tester) async {
    await tester.pumpWidget(
      wrap(EarnScreen(
        api: clientReturning(
            meJson(freeTier: false, regionSupported: false)),
        ads: ads,
      )),
    );
    await tester.pumpAndSettle();

    // The honest-refusal copy is a deliberate product decision, not filler.
    // If someone softens it into "temporarily unavailable", this fails.
    expect(
        find.textContaining('not offered for United Kingdom'), findsOneWidget);
  });

  testWidgets('never leaves the earn button dead without saying why',
      (tester) async {
    // The gap this closes: freeTierAvailable gated the button, but every
    // explanatory branch keyed off other fields — so an ordinary combination
    // produced an inert button reading "Watch ad · earn 8 MB" and no reason
    // anywhere on screen.
    await tester.pumpWidget(
      wrap(EarnScreen(
        api: clientReturning(meJson(freeTier: false)),
        ads: ads,
      )),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Watch ad'), findsNothing);
    expect(find.text('Free data unavailable'), findsOneWidget);
    expect(find.textContaining('Earning is paused'), findsOneWidget);
  });

  testWidgets('a spent daily pool is never reported as an unsupported region',
      (tester) async {
    // These were one boolean once. When the global cap tripped, an
    // honesty-branded app told every user in every country that their
    // destination was unsupported.
    await tester.pumpWidget(
      wrap(EarnScreen(
        api: clientReturning(meJson(freeTier: false, budgetExhausted: true)),
        ads: ads,
      )),
    );
    await tester.pumpAndSettle();

    // Matched against the exact string in earn_screen.dart. It read
    // "free-data" here and "free data" there, so this assertion failed on a
    // build that was working correctly. A test that pins user facing copy is
    // worth keeping, but only if it is pinned to the copy that ships.
    expect(find.textContaining("Today's free data pool is used up"),
        findsOneWidget);
    expect(find.textContaining('not offered for'), findsNothing);
  });

  testWidgets('shows how far off redemption the user is', (tester) async {
    await tester.pumpWidget(
      wrap(EarnScreen(api: clientReturning(meJson(balanceMb: 24)), ads: ads)),
    );
    await tester.pumpAndSettle();

    // 50 threshold - 24 balance = 26 to go.
    expect(find.textContaining('26 MB to go'), findsOneWidget);
  });

  testWidgets('surfaces a network failure instead of hanging', (tester) async {
    final broken = ApiClient(
      baseUrl: 'https://test.invalid',
      inner: MockClient((_) async => http.Response('nope', 500)),
    );

    await tester.pumpWidget(wrap(EarnScreen(api: broken, ads: ads)));
    await tester.pumpAndSettle();

    // The full-screen ErrorState, not the inline status line: with no `Me` at
    // all there is no list to render a status line into. This is the airport
    // captive-portal case, and the only requirement is that it is escapable.
    expect(find.textContaining("Can't reach us right now"), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
