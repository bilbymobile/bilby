import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../brand.dart';
import '../widgets/common.dart';

/// Paid plans.
///
/// ## Why checkout leaves the app
///
/// Google Play's Payments policy exempts purchases *consumed outside* a
/// Play-distributed app, and mobile connectivity is consumed by the handset's
/// modem rather than inside this app. That is the basis on which eSIM apps take
/// card payments directly instead of paying Play Billing's 15%.
///
/// It is an interpretation, not a written eSIM carve-out, so the structure here
/// is deliberately conservative:
///
///   * Checkout opens in an external browser. Not a webview, not embedded.
///   * No app feature is ever gated behind a purchase — the moment one is, a
///     data plan becomes an in-app digital good and the exemption argument
///     collapses.
///   * The app can browse and price plans; the transaction happens on the web.
///
/// Fifteen percent of a 45% margin is a third of your profit, so this is worth
/// getting right the first time rather than after a policy review.
class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  static const _destinations = <String, String>{
    'JP': 'Japan',
    'ID': 'Indonesia',
    'TH': 'Thailand',
    'VN': 'Vietnam',
    'SG': 'Singapore',
    'US': 'United States',
    'GB': 'United Kingdom',
    'IT': 'Italy',
    'AE': 'UAE',
    'NZ': 'New Zealand',
  };

  String _iso = 'JP';
  List<CatalogPlan>? _plans;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _plans = null;
      _error = null;
    });
    try {
      final plans = await widget.api.catalog(_iso);
      if (mounted) setState(() => _plans = plans);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _buy(CatalogPlan plan) async {
    // External browser, deliberately. See the class doc.
    final uri = Uri.parse(
      '${Brand.appBase}/checkout?plan=${Uri.encodeComponent(plan.planId)}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open checkout.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return ErrorState(onRetry: _load, detail: _error.toString());
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: Brand.accent,
      backgroundColor: Brand.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          const SectionTitle(
            'Plans',
            subtitle:
                'Full speed, no ads, hotspot included. Buy one only for the days '
                'you actually need it. The free tier covers maps and messages '
                'the rest of the time.',
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _destinations.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final iso = _destinations.keys.elementAt(i);
                final selected = iso == _iso;
                return GestureDetector(
                  onTap: selected
                      ? null
                      : () {
                          setState(() => _iso = iso);
                          _load();
                        },
                  child: AnimatedContainer(
                    duration: Motion.fast,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: selected ? Brand.accent : Brand.surface2,
                      borderRadius: BorderRadius.circular(99),
                      border: selected ? null : Border.all(color: Brand.border),
                    ),
                    child: Text(
                      _destinations[iso]!,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: selected ? const Color(0xFF04120C) : Brand.muted,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 18),
          if (_plans == null)
            const Padding(
              padding: EdgeInsets.only(top: 60),
              child: Loading(),
            )
          else if (_plans!.isEmpty)
            const AppCard(
              child: Text('No plans for this destination yet.',
                  style: TextStyle(color: Brand.muted)),
            )
          else
            ..._plans!.map(_planCard),
          const SizedBox(height: 16),
          const Note(
            'Checkout opens in your browser. Your eSIM appears in My eSIMs as '
            'soon as payment clears.',
          ),
        ],
      ),
    );
  }

  Widget _planCard(CatalogPlan plan) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: AppCard(
          padding: 16,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(plan.dataLabel,
                            style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: Brand.text,
                                letterSpacing: -0.4)),
                        const SizedBox(width: 8),
                        Pill('${plan.validityDays} days'),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      plan.perGbUsd == null
                          ? plan.name
                          : '\$${plan.perGbUsd!.toStringAsFixed(2)} per GB',
                      style: const TextStyle(fontSize: 13, color: Brand.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: () => _buy(plan),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                  decoration: BoxDecoration(
                    color: Brand.accent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '\$${plan.retailUsd.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: Color(0xFF04120C)),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}
