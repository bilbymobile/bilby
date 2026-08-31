import 'dart:convert';
import 'package:flutter/services.dart' show MissingPluginException;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../brand.dart';
import 'models.dart';

/// API client for the Next.js backend.
///
/// ## Why this app persists a cookie by hand
///
/// The backend identifies users with an HMAC-signed cookie and no login screen
/// — install, tap, get data. `package:http` does not manage a cookie jar, and
/// Android's WebView jar is irrelevant here because Flutter never opens one.
/// So the session cookie is captured from the first response and replayed on
/// every subsequent request.
///
/// This matters more than plumbing usually does: the cookie **is** the user's
/// account. Lose it and they lose their data balance with no way to recover it,
/// because there is no email on file. Hence [SharedPreferences] rather than
/// in-memory, and hence the eventual need for an account-recovery path before
/// you let anyone accumulate a balance worth caring about.
class ApiClient {
  ApiClient({http.Client? inner, this.baseUrl = Brand.apiBase})
      : _http = inner ?? http.Client();

  final http.Client _http;
  final String baseUrl;

  static const _cookieKey = 'session_cookie';
  String? _cookie;
  bool _loaded = false;

  Future<void> _loadCookie() async {
    if (_loaded) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      _cookie = prefs.getString(_cookieKey);
      _loaded = true;
    } on MissingPluginException {
      // No platform channel — a widget test, or a launch so early that plugins
      // have not registered. Degrade to an in-memory session rather than
      // letting a storage failure take down every request the app makes:
      // without this the exception propagates out of `me()` and every screen
      // renders its network-error state, which is both wrong and very
      // confusing to debug.
      //
      // _loaded stays FALSE on purpose, so a later request retries the read.
      // Latching it true would mean a transient failure permanently orphans
      // the account: the cookie IS the user's balance, and _captureCookie
      // would then write a fresh session id over the stored one with no
      // recovery path, because there is no email on file.
      _cookie = null;
    }
  }

  Future<void> _captureCookie(http.Response res) async {
    final raw = res.headers['set-cookie'];
    if (raw == null || raw.isEmpty) return;

    // Take only the name=value pair; attributes (Path, HttpOnly, Max-Age) are
    // the server's business and echoing them back is invalid.
    final pair = raw.split(';').first.trim();

    // Match on the `_uid=` suffix rather than a hardcoded brand prefix. The
    // server derives its cookie name from the brand slug, so pinning the exact
    // string here means a rename silently breaks sessions — and the symptom is
    // "every launch is a new user with zero balance", which looks like a
    // ledger bug rather than a cookie bug and costs a day to find.
    if (!RegExp(r'^[a-z0-9_]+_uid=').hasMatch(pair)) return;
    if (pair == _cookie) return;

    _cookie = pair;
    // Only persist if we successfully READ storage first. See _loadCookie:
    // writing a new session id over an unread store is how a balance gets
    // orphaned.
    if (!_loaded) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cookieKey, pair);
    } on MissingPluginException {
      // Same reasoning as _loadCookie. The in-memory _cookie above is already
      // set, so the session still works for this launch; only persistence is
      // lost, and that beats failing the request that just succeeded.
    }
  }

  Map<String, String> _headers({String? country}) => {
        'accept': 'application/json',
        if (_cookie != null) 'cookie': _cookie!,
        // Lets the backend price grants correctly during development, when
        // there is no CDN geo header. In production the CDN supplies it and
        // this is ignored — the server never trusts it over a real geo header
        // for anything that spends money.
        if (country != null) 'x-nesim-country': country,
      };

  Future<T> _get<T>(String path, T Function(Map<String, dynamic>) parse,
      {String? country}) async {
    await _loadCookie();
    final res = await _http
        .get(Uri.parse('$baseUrl$path'), headers: _headers(country: country))
        .timeout(const Duration(seconds: 15));
    await _captureCookie(res);

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, res.body);
    }
    return parse(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<Me> me({String? country}) =>
      _get('/api/me', Me.fromJson, country: country);

  Future<RedeemResult> redeem() async {
    await _loadCookie();
    final res = await _http
        .post(Uri.parse('$baseUrl/api/redeem'), headers: _headers())
        // Provisioning talks to a supplier and occasionally to an SM-DP+.
        // 15s is not enough; 45 is realistic.
        .timeout(const Duration(seconds: 45));
    await _captureCookie(res);

    // 4xx here are meaningful business outcomes (below threshold, no fundable
    // plan), not failures — parse them rather than throwing.
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return RedeemResult.fromJson(body);
  }

  /// The destination catalogue, priced for this user.
  Future<List<DestinationOption>> destinations({String? country}) async {
    await _loadCookie();
    final res = await _http
        .get(
          Uri.parse('$baseUrl/api/me/destination'),
          headers: _headers(country: country),
        )
        .timeout(const Duration(seconds: 15));
    await _captureCookie(res);
    if (res.statusCode >= 400) throw ApiException(res.statusCode, res.body);

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return ((body['destinations'] as List?) ?? const [])
        .map((e) => DestinationOption.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Set where the data will be used.
  ///
  /// Throws on a rejected destination rather than returning a result object:
  /// the client only ever sends an ISO code it received from [destinations],
  /// so a rejection here means the catalogue and the allowlist have diverged —
  /// a bug to surface loudly, not a state to render.
  Future<void> setDestination(String iso) async {
    await _loadCookie();
    final res = await _http
        .put(
          Uri.parse('$baseUrl/api/me/destination'),
          headers: {..._headers(), 'content-type': 'application/json'},
          body: jsonEncode({'destination': iso}),
        )
        .timeout(const Duration(seconds: 15));
    await _captureCookie(res);
    if (res.statusCode >= 400) throw ApiException(res.statusCode, res.body);
  }

  Future<EsimDetail> esim(String iccid) =>
      _get('/api/esim/$iccid', EsimDetail.fromJson);

  /// Retail catalogue for a destination.
  Future<List<CatalogPlan>> catalog(String countryIso) async {
    await _loadCookie();
    final res = await _http
        .get(
          Uri.parse('$baseUrl/api/catalog?country=${countryIso.toUpperCase()}'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 20));
    await _captureCookie(res);
    if (res.statusCode >= 400) throw ApiException(res.statusCode, res.body);

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return ((body['plans'] as List?) ?? const [])
        .map((e) => CatalogPlan.fromJson(e as Map<String, dynamic>))
        // Micro packets are free-tier plumbing, not retail. Showing a 50 MB
        // packet next to a 5 GB plan makes the catalogue look broken.
        .where((p) => p.dataMb >= 1024)
        .toList();
  }

  void close() => _http.close();
}

class ApiException implements Exception {
  final int status;
  final String body;
  const ApiException(this.status, this.body);

  @override
  String toString() => 'ApiException($status): $body';
}
