/// Wire models for the Next.js API.
///
/// Hand-written rather than generated: the API surface is six endpoints, and a
/// build_runner dependency for that is not a trade worth making. If this grows
/// past a dozen models, switch to freezed + json_serializable.
library;

class Me {
  final String ssvUserId;
  final String country;
  final String homeCountry;

  /// Where the data will be used. Null until the user has picked one.
  ///
  /// Deliberately nullable rather than defaulted: [needsDestination] is derived
  /// from exactly this, and defaulting it to the current country here would
  /// silently skip first-run setup for every user — which is the bug this whole
  /// screen exists to fix.
  final String? destination;
  final String destinationName;
  final bool needsDestination;

  /// Is the handset in the market it signed up from?
  final bool atHome;

  /// Grant per ad while still at home, versus once they have arrived. Shown
  /// side by side because for most destinations these differ by 2x and the
  /// user is entitled to know which way round.
  final int atHomeMbPerAd;
  final int onArrivalMbPerAd;

  /// True when the free tier for this destination only works if they stock up
  /// before departure.
  final bool bankBeforeYouFly;

  final int balanceMb;
  final int mbPerAd;
  final int naiveMbPerAd;
  final int adsWatchedToday;
  final int dailyAdCap;
  final int adsRemainingToday;
  final int redemptionThresholdMb;
  final bool canRedeem;
  final bool freeTierAvailable;
  final bool regionSupported;
  final bool budgetExhausted;
  final List<EsimSummary> esims;

  const Me({
    required this.ssvUserId,
    required this.country,
    required this.homeCountry,
    required this.destination,
    required this.destinationName,
    required this.needsDestination,
    required this.atHome,
    required this.atHomeMbPerAd,
    required this.onArrivalMbPerAd,
    required this.bankBeforeYouFly,
    required this.balanceMb,
    required this.mbPerAd,
    required this.naiveMbPerAd,
    required this.adsWatchedToday,
    required this.dailyAdCap,
    required this.adsRemainingToday,
    required this.redemptionThresholdMb,
    required this.canRedeem,
    required this.freeTierAvailable,
    required this.regionSupported,
    required this.budgetExhausted,
    required this.esims,
  });

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        ssvUserId: j['ssvUserId'] as String,
        country: j['country'] as String? ?? 'AU',
        homeCountry: j['homeCountry'] as String? ?? 'AU',
        destination: j['destination'] as String?,
        // Falls back to the ISO code rather than an empty string: a blank here
        // renders as "EARNING FOR" with nothing under it and "right now that is
        // 8 MB for ." — on the one screen whose entire job is making the number
        // feel trustworthy.
        destinationName: j['destinationName'] as String? ??
            j['destination'] as String? ??
            'your destination',
        // Falls back to "is destination null?" rather than to a fixed default.
        // A response old enough to lack this flag still tells us whether a
        // destination exists, and that is the same question. Erring toward
        // showing the picker is the safe direction: asking twice is a mild
        // annoyance, never asking recreates the bug this all exists to fix.
        needsDestination:
            j['needsDestination'] as bool? ?? (j['destination'] == null),
        atHome: j['atHome'] as bool? ?? false,
        atHomeMbPerAd: (j['atHomeMbPerAd'] as num?)?.toInt() ?? 0,
        onArrivalMbPerAd: (j['onArrivalMbPerAd'] as num?)?.toInt() ?? 0,
        bankBeforeYouFly: j['bankBeforeYouFly'] as bool? ?? false,
        balanceMb: (j['balanceMb'] as num?)?.toInt() ?? 0,
        mbPerAd: (j['mbPerAd'] as num?)?.toInt() ?? 0,
        naiveMbPerAd: (j['naiveMbPerAd'] as num?)?.toInt() ?? 0,
        adsWatchedToday: (j['adsWatchedToday'] as num?)?.toInt() ?? 0,
        dailyAdCap: (j['dailyAdCap'] as num?)?.toInt() ?? 10,
        adsRemainingToday: (j['adsRemainingToday'] as num?)?.toInt() ?? 0,
        redemptionThresholdMb:
            (j['redemptionThresholdMb'] as num?)?.toInt() ?? 50,
        canRedeem: j['canRedeem'] as bool? ?? false,
        freeTierAvailable: j['freeTierAvailable'] as bool? ?? false,
        regionSupported: j['regionSupported'] as bool? ?? true,
        budgetExhausted: j['budgetExhausted'] as bool? ?? false,
        esims: ((j['esims'] as List?) ?? const [])
            .map((e) => EsimSummary.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  /// Progress toward the point where credits become real data, 0..1.
  double get redemptionProgress =>
      redemptionThresholdMb == 0
          ? 0
          : (balanceMb / redemptionThresholdMb).clamp(0.0, 1.0);
}

/// One row in the destination picker, priced by the server for this user.
///
/// The rate card never leaves the backend — the client receives two integers
/// and three booleans, not the wholesale table that produced them.
class DestinationOption {
  final String iso;
  final String name;
  final String flag;
  final String? blurb;

  /// A caveat the user should see BEFORE they start earning. Rendered in the
  /// picker, not buried in terms.
  final String? caution;

  final int atHomeMb;
  final int onArrivalMb;
  final bool freeTierAtHome;
  final bool freeTierOnArrival;
  final bool bankBeforeYouFly;

  const DestinationOption({
    required this.iso,
    required this.name,
    required this.flag,
    this.blurb,
    this.caution,
    required this.atHomeMb,
    required this.onArrivalMb,
    required this.freeTierAtHome,
    required this.freeTierOnArrival,
    required this.bankBeforeYouFly,
  });

  factory DestinationOption.fromJson(Map<String, dynamic> j) =>
      DestinationOption(
        iso: j['iso'] as String,
        name: j['name'] as String,
        flag: j['flag'] as String? ?? '',
        blurb: j['blurb'] as String?,
        caution: j['caution'] as String?,
        atHomeMb: (j['atHomeMb'] as num?)?.toInt() ?? 0,
        onArrivalMb: (j['onArrivalMb'] as num?)?.toInt() ?? 0,
        freeTierAtHome: j['freeTierAtHome'] as bool? ?? false,
        freeTierOnArrival: j['freeTierOnArrival'] as bool? ?? false,
        bankBeforeYouFly: j['bankBeforeYouFly'] as bool? ?? false,
      );

  /// Free data works here somehow — before departure, after arrival, or both.
  bool get freeTierPossible => freeTierAtHome || freeTierOnArrival;

  /// The headline number: the best a single ad can do for this destination.
  int get bestMb => atHomeMb > onArrivalMb ? atHomeMb : onArrivalMb;
}

class EsimSummary {
  final String iccid;
  final bool isFreeTier;
  final DateTime createdAt;
  final DateTime? installedAt;

  const EsimSummary({
    required this.iccid,
    required this.isFreeTier,
    required this.createdAt,
    this.installedAt,
  });

  factory EsimSummary.fromJson(Map<String, dynamic> j) => EsimSummary(
        iccid: j['iccid'] as String,
        // SQLite has no boolean type, so the API returns 0/1 here.
        isFreeTier: (j['is_free_tier'] as num?)?.toInt() == 1,
        createdAt:
            DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime(1970),
        installedAt: j['installed_at'] == null
            ? null
            : DateTime.tryParse(j['installed_at'] as String),
      );
}

class RedeemResult {
  final bool ok;
  final String? reason;
  final String? iccid;
  final int redeemedMb;
  final int newBalanceMb;
  final bool isNewProfile;

  const RedeemResult({
    required this.ok,
    this.reason,
    this.iccid,
    this.redeemedMb = 0,
    this.newBalanceMb = 0,
    this.isNewProfile = false,
  });

  factory RedeemResult.fromJson(Map<String, dynamic> j) => RedeemResult(
        ok: j['ok'] as bool? ?? false,
        reason: j['reason'] as String?,
        iccid: j['iccid'] as String?,
        redeemedMb: (j['redeemedMb'] as num?)?.toInt() ?? 0,
        newBalanceMb: (j['newBalanceMb'] as num?)?.toInt() ?? 0,
        isNewProfile: j['isNewProfile'] as bool? ?? false,
      );
}

class EsimProfile {
  final String iccid;
  final String activationCode;
  final String smdpAddress;
  final String matchingId;

  const EsimProfile({
    required this.iccid,
    required this.activationCode,
    required this.smdpAddress,
    required this.matchingId,
  });

  factory EsimProfile.fromJson(Map<String, dynamic> j) => EsimProfile(
        iccid: j['iccid'] as String,
        activationCode: j['activationCode'] as String,
        smdpAddress: j['smdpAddress'] as String,
        matchingId: j['matchingId'] as String,
      );
}

/// A retail plan as priced by the server.
///
/// Note what is absent: wholesale cost. The server computes retail from
/// wholesale and never sends the input. A client that knows your margin is one
/// screenshot away from being a competitor's pricing intelligence.
class CatalogPlan {
  final String planId;
  final String name;
  final List<String> countries;
  final int dataMb;
  final int validityDays;
  final double retailUsd;
  final double? perGbUsd;

  const CatalogPlan({
    required this.planId,
    required this.name,
    required this.countries,
    required this.dataMb,
    required this.validityDays,
    required this.retailUsd,
    this.perGbUsd,
  });

  factory CatalogPlan.fromJson(Map<String, dynamic> j) => CatalogPlan(
        planId: j['planId'] as String,
        name: j['name'] as String,
        countries:
            ((j['countries'] as List?) ?? const []).map((e) => e.toString()).toList(),
        dataMb: (j['dataMb'] as num?)?.toInt() ?? 0,
        validityDays: (j['validityDays'] as num?)?.toInt() ?? 0,
        retailUsd: (j['retailUsd'] as num?)?.toDouble() ?? 0,
        perGbUsd: (j['perGbUsd'] as num?)?.toDouble(),
      );

  String get dataLabel => dataMb >= 1024
      ? '${(dataMb / 1024).toStringAsFixed(dataMb % 1024 == 0 ? 0 : 1)} GB'
      : '$dataMb MB';
}

/// Full detail for one eSIM, including the activation material.
class EsimDetail {
  final String iccid;
  final String activationCode;
  final String smdpAddress;
  final String matchingId;
  final bool isFreeTier;
  final UsageSnapshot? usage;

  const EsimDetail({
    required this.iccid,
    required this.activationCode,
    required this.smdpAddress,
    required this.matchingId,
    required this.isFreeTier,
    this.usage,
  });

  factory EsimDetail.fromJson(Map<String, dynamic> j) => EsimDetail(
        iccid: j['iccid'] as String,
        activationCode: j['activationCode'] as String,
        smdpAddress: j['smdpAddress'] as String,
        matchingId: j['matchingId'] as String,
        isFreeTier: j['isFreeTier'] as bool? ?? false,
        usage: j['usage'] == null
            ? null
            : UsageSnapshot.fromJson(j['usage'] as Map<String, dynamic>),
      );
}

class UsageSnapshot {
  final int totalMb;
  final int usedMb;
  final int remainingMb;
  final String status;

  const UsageSnapshot({
    required this.totalMb,
    required this.usedMb,
    required this.remainingMb,
    required this.status,
  });

  factory UsageSnapshot.fromJson(Map<String, dynamic> j) => UsageSnapshot(
        totalMb: (j['totalMb'] as num?)?.toInt() ?? 0,
        usedMb: (j['usedMb'] as num?)?.toInt() ?? 0,
        remainingMb: (j['remainingMb'] as num?)?.toInt() ?? 0,
        status: j['status'] as String? ?? 'unknown',
      );
}
