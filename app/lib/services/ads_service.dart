import 'dart:async';
import 'package:google_mobile_ads/google_mobile_ads.dart';

/// Rewarded ads.
///
/// The single most important thing in this file is what it does *not* do:
/// **it never grants anything.** `onUserEarnedReward` is a client-side event.
/// It fires on a device you do not control, in a process anyone can attach a
/// debugger to. Treating it as proof of an ad view turns the free tier into an
/// open faucet on your supplier wallet.
///
/// The real flow:
///
///   1. This code loads an ad and attaches the user's **signed** id via
///      [ServerSideVerificationOptions].
///   2. The user watches it.
///   3. Google's servers — not this app — call `/api/ads/ssv` on your backend.
///   4. The backend verifies an ECDSA signature, checks the transaction id has
///      not been seen, checks caps and budget, and *then* moves the ledger.
///   5. This app polls `/api/me` until the balance changes.
///
/// So `onUserEarnedReward` is used for exactly one thing here: knowing when to
/// start polling.
class AdsService {
  AdsService({required this.rewardedAdUnitId});

  final String rewardedAdUnitId;

  RewardedAd? _ad;
  bool _loading = false;
  bool _initialised = false;

  /// Google's official rewarded test unit.
  ///
  /// Pointing a debug build at production inventory is the fastest way to have
  /// an AdMob account suspended for invalid traffic, and suspension is not
  /// easily reversed. Never ship a release pointing here, and never debug
  /// against a real unit.
  static const testRewardedUnit = 'ca-app-pub-3940256099942544/5224354917';

  /// Initialise the ads SDK.
  ///
  /// Deliberately swallows failures. The SDK can fail to start for reasons that
  /// have nothing to do with your app — no Play Services on the device, a
  /// stripped ROM, an offline cold start, or a widget test with no platform
  /// channels. None of those should take the whole app down: the user can still
  /// browse plans, open their eSIM and read their activation code. They simply
  /// cannot earn until it recovers, and [show] reports that honestly.
  Future<void> init() async {
    if (_initialised) return;
    try {
      await MobileAds.instance.initialize();
      _initialised = true;
      // Warm one up immediately. A rewarded ad takes 1-3s to load; making the
      // user wait after they've already decided to watch is where they quit.
      unawaited(preload());
    } catch (_) {
      _initialised = false;
    }
  }

  bool get isReady => _ad != null;

  /// Load an ad into the chamber. Safe to call repeatedly.
  Future<void> preload() async {
    if (_ad != null || _loading) return;
    _loading = true;

    final completer = Completer<void>();
    // Fire-and-forget on purpose: the Completer below is what we actually wait
    // on, since the result arrives through the load callbacks.
    unawaited(RewardedAd.load(
      adUnitId: rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _ad = ad;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
        onAdFailedToLoad: (error) {
          _ad = null;
          _loading = false;
          if (!completer.isCompleted) completer.complete();
        },
      ),
    ));
    return completer.future;
  }

  /// Show an ad.
  ///
  /// [signedUserId] must be the `ssvUserId` from `/api/me` — the HMAC-signed
  /// value, never a raw uuid. The backend rejects an unsigned id, which is what
  /// stops someone pointing rewards at another user's account.
  ///
  /// Returns true if the ad was watched to completion. That is a signal to
  /// start polling, **not** a promise that anything was credited.
  Future<AdResult> show(String signedUserId) async {
    if (_ad == null) {
      await preload();
      if (_ad == null) return AdResult.noFill;
    }

    final ad = _ad!;
    _ad = null; // A RewardedAd is single-use. Reusing one throws.

    var earned = false;
    final done = Completer<AdResult>();

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        // Queue the next one while the user reads their new balance.
        unawaited(preload());
        if (!done.isCompleted) {
          done.complete(earned ? AdResult.watched : AdResult.dismissed);
        }
      },
      onAdFailedToShowFullScreenContent: (ad, err) {
        ad.dispose();
        unawaited(preload());
        if (!done.isCompleted) done.complete(AdResult.error);
      },
    );

    // THE line that connects the ad to the ledger. Without it the SSV callback
    // arrives with no user_id and the backend has no idea who to credit.
    await ad.setServerSideOptions(
      ServerSideVerificationOptions(userId: signedUserId),
    );

    await ad.show(onUserEarnedReward: (_, __) => earned = true);
    return done.future;
  }

  void dispose() {
    _ad?.dispose();
    _ad = null;
  }
}

enum AdResult {
  /// Watched to completion. Start polling for the credit.
  watched,

  /// Closed early. Nothing was earned, and saying so plainly beats a spinner.
  dismissed,

  /// No inventory. Common in low-eCPM markets — expect 30-45% no-fill there.
  noFill,

  error,
}
