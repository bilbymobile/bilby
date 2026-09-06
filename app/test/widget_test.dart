// Tests against the seam that matters: `ApiClient` takes an injectable
// `http.Client`, so the whole app can be driven from canned responses with no
// backend, no network and no emulator.
//
// These replaced the earn screen tests when the free tier was dropped. The old
// ones were good tests of a product that no longer exists; several of them
// pinned user facing copy about ad rewards, which is exactly the copy that had
// to go.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bilby/api/client.dart';
import 'package:bilby/screens/plans_screen.dart';

/// One plan, shaped exactly as `/api/catalog` returns it.
Map<String, dynamic> plan({
  String planId = 'jp-5gb-15d',
  String name = 'Japan 5 GB',
  int dataMb = 5120,
  int validityDays = 15,
  double retailUsd = 18.0,
  double? perGbUsd = 3.6,
}) =>
    {
      'planId': planId,
      'name': name,
      'countries': ['JP'],
      'dataMb': dataMb,
      'validityDays': validityDays,
      'retailUsd': retailUsd,
      'perGbUsd': perGbUsd,
    };

ApiClient clientReturning(Map<String, dynamic> payload, {int status = 200}) =>
    ApiClient(
      baseUrl: 'https://test.invalid',
      inner: MockClient((req) async => http.Response(
            jsonEncode(payload),
            status,
            headers: {'content-type': 'application/json'},
          )),
    );

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ApiClient reads its session cookie from SharedPreferences BEFORE it touches
  // the injected http client, so without this every test below would get a
  // MissingPluginException, fall into the error branch, and render the full
  // screen ErrorState instead of the plans list, quietly asserting nothing.
  // Per test, because setMockInitialValues also resets the cached instance.
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  testWidgets('shows a spinner before the first response lands',
      (tester) async {
    await tester.pumpWidget(
      wrap(PlansScreen(api: clientReturning({'plans': [plan()]}))),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders a plan with its size, validity and price',
      (tester) async {
    await tester.pumpWidget(
      wrap(PlansScreen(api: clientReturning({'plans': [plan()]}))),
    );
    await tester.pumpAndSettle();

    expect(find.text('5 GB'), findsOneWidget);
    expect(find.text('15 days'), findsOneWidget);
    expect(find.text('\$18.00'), findsOneWidget);
  });

  testWidgets('hides micro packets, which are not retail products',
      (tester) async {
    // A 50 MB packet beside a 5 GB plan makes the catalogue look broken. The
    // filter lives in ApiClient.catalog, so it is worth a test: it is the kind
    // of line that gets deleted during a refactor because it looks arbitrary.
    await tester.pumpWidget(
      wrap(PlansScreen(
        api: clientReturning({
          'plans': [
            plan(),
            plan(planId: 'jp-50mb', name: 'Japan 50 MB', dataMb: 50),
          ],
        }),
      )),
    );
    await tester.pumpAndSettle();

    expect(find.text('5 GB'), findsOneWidget);
    expect(find.text('50 MB'), findsNothing);
  });

  testWidgets('says so plainly when a destination has no plans yet',
      (tester) async {
    await tester.pumpWidget(
      wrap(PlansScreen(api: clientReturning({'plans': <dynamic>[]}))),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('No plans for this destination'), findsOneWidget);
  });

  testWidgets('never advertises a free tier', (tester) async {
    // The free tier is dropped. This pins that: the word must not reappear in
    // this screen's copy through a careless revert.
    await tester.pumpWidget(
      wrap(PlansScreen(api: clientReturning({'plans': [plan()]}))),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('free tier'), findsNothing);
    expect(find.textContaining('Watch ad'), findsNothing);
  });

  testWidgets('surfaces a backend failure instead of hanging', (tester) async {
    await tester.pumpWidget(
      wrap(PlansScreen(
        api: clientReturning({'error': 'nope'}, status: 500),
      )),
    );
    await tester.pumpAndSettle();

    // The full screen ErrorState, and the only real requirement is that it is
    // escapable. This is the airport captive portal case.
    expect(find.text('Try again'), findsOneWidget);
  });
}
