import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

/// Whether this handset can install an eSIM at all.
///
/// [unknown] is a first-class outcome, not a placeholder. The check can fail
/// for reasons that say nothing about the device — a platform channel missing
/// on an older build, an OEM that does not report the feature honestly — and
/// treating "we could not tell" as "no" would lock users out of a product that
/// works fine on their phone.
enum EsimSupport { supported, unsupported, unknown }

/// eSIM installation.
///
/// ## Why a universal link and not a native eSIM plugin
///
/// Android exposes `EuiccManager.downloadSubscription()`, and there are Flutter
/// packages wrapping it. It is tempting and it is a trap for an app like this:
/// on most retail devices that API requires the caller to be a **carrier
/// privileged** app, meaning your certificate has to be listed in the carrier
/// configuration on the SIM. You are a reseller. You will not have that.
///
/// So the supported path for everyone who is not an MNO is the universal link,
/// which hands the LPA string to the system's own eSIM installer:
///
///   Android 10+   `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=<LPA>`
///   iOS 17.4+     `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=<LPA>`
///
/// Same parameter, same payload, different host. One tap into the OS flow, no
/// privileged permissions, no QR scan.
///
/// This is also the single biggest conversion lever in the funnel. Most
/// competitors still lead with a QR code — which is useless on the device
/// that's displaying it.
class EsimService {
  /// Launch the system eSIM installer for an LPA activation string.
  ///
  /// [activationCode] is the full `LPA:1$<smdp>$<matchingId>` string.
  ///
  /// Returns false when the platform can't handle the link — older Android
  /// builds and pre-17.4 iOS just open a browser page. That is not an error to
  /// hide; it is the cue to show the QR code and manual entry instead.
  static Future<bool> installViaUniversalLink(
    String activationCode, {
    required bool isIOS,
  }) async {
    // Must be percent-encoded: the LPA string contains `$`, which is legal in a
    // query value but mangled by some launchers if left raw.
    final encoded = Uri.encodeComponent(activationCode);
    final host = isIOS ? 'esimsetup.apple.com' : 'esimsetup.android.com';
    final uri = Uri.parse(
      'https://$host/esim_qrcode_provisioning?carddata=$encoded',
    );

    if (!await canLaunchUrl(uri)) return false;

    // externalApplication, not inAppWebView. The whole point is to leave the
    // app and hand off to the OS — rendering this inside a webview does
    // nothing at all.
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  /// Does this handset support eSIM?
  ///
  /// Asked before the user invests days of ad-watching, not after — the review
  /// found there was no compatibility check anywhere in the app, which meant
  /// somebody on an eSIM-less handset could earn a full balance and only
  /// discover the problem at the one moment it could not be solved.
  ///
  /// The honest answer on Android comes from the system's own eUICC service,
  /// via `EuiccManager.isEnabled` — readable without carrier privilege, unlike
  /// the download API. That needs a platform channel, which is registered in
  /// MainActivity; until that ships, a missing channel resolves to [unknown]
  /// rather than a guess, and the UI degrades to a soft warning.
  ///
  /// Deliberately NOT inferred from the OS version. Android 9 introduced the
  /// API, but plenty of Android 13 handsets sold in South Asia and Africa ship
  /// without eUICC hardware — a version check would confidently clear exactly
  /// the devices most likely to fail, in exactly the markets we just added.
  static Future<EsimSupport> deviceSupport() async {
    try {
      final ok = await _channel.invokeMethod<bool>('isEsimSupported');
      if (ok == null) return EsimSupport.unknown;
      return ok ? EsimSupport.supported : EsimSupport.unsupported;
    } on MissingPluginException {
      // Channel not registered — iOS, or an Android build predating the
      // MainActivity change. Not a device capability signal.
      return EsimSupport.unknown;
    } on PlatformException {
      return EsimSupport.unknown;
    }
  }

  static const _channel = MethodChannel('bilby/esim');

  /// Split an LPA string into its parts, for the manual-entry fallback.
  ///
  /// Manual entry is ugly and it is also the only thing that works on older
  /// Androids. It converts the users who would otherwise become support
  /// tickets, so it earns its place on the screen.
  static ({String smdp, String matchingId})? parseLpa(String activationCode) {
    final m = RegExp(r'^LPA:1\$([^$]+)\$([^$]+)', caseSensitive: false)
        .firstMatch(activationCode);
    if (m == null) return null;
    return (smdp: m.group(1)!, matchingId: m.group(2)!);
  }

  /// The one thing to tell every user after install.
  ///
  /// A travel eSIM is a roaming profile. With data roaming off it attaches to
  /// nothing and looks broken, and this is the most common support ticket in
  /// the entire category. Say it before they ask, not in an FAQ.
  static const roamingReminder =
      'Switch data roaming ON for this eSIM in your phone settings. It will '
      'not connect otherwise. Keep your usual SIM for calls and texts.';
}
