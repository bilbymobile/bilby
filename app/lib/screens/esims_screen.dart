import 'package:flutter/material.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../brand.dart';
import '../widgets/common.dart';
import 'install_screen.dart';

/// The user's eSIMs.
///
/// Usually one: the free tier profile, installed once and topped up rather than
/// reissued. That single profile design is the retention moat, because once the
/// eSIM is on the phone and silently receiving data, switching to a competitor
/// means a fresh QR scan and a new profile on every trip.
///
/// "Forever" is not available and the copy no longer claims it. Airalo confirmed
/// the industry lifecycle: 90 days from issuance to activate, then 90 days of
/// grace after the last package expires, measured from package expiry rather
/// than from last data usage. A top up restarts the clock. So a dormant profile
/// survives roughly four months, and the honest promise is that we reissue free
/// when it lapses.
class EsimsScreen extends StatefulWidget {
  const EsimsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<EsimsScreen> createState() => _EsimsScreenState();
}

class _EsimsScreenState extends State<EsimsScreen> {
  List<EsimSummary>? _esims;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final me = await widget.api.me();
      if (mounted) setState(() => _esims = me.esims);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _esims == null) {
      return ErrorState(onRetry: _load, detail: _error.toString());
    }
    if (_esims == null) return const Loading();

    return RefreshIndicator(
      onRefresh: _load,
      color: Brand.accent,
      backgroundColor: Brand.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          const SectionTitle(
            'My eSIMs',
            subtitle:
                'Install once and keep it. Every ad you watch tops up this same '
                'profile rather than issuing a new one.',
          ),
          const SizedBox(height: 20),
          if (_esims!.isEmpty)
            const AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Nothing here yet',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Brand.text)),
                  SizedBox(height: 8),
                  Text(
                    'Earn enough data to load onto an eSIM and we will issue '
                    'your profile then, not before. That way you never install '
                    'something you have no data for.',
                    style: TextStyle(
                        fontSize: 14, color: Brand.muted, height: 1.5),
                  ),
                ],
              ),
            )
          else
            ..._esims!.map(_tile),
        ],
      ),
    );
  }

  Widget _tile(EsimSummary e) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: GestureDetector(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => InstallScreen(api: widget.api, iccid: e.iccid),
            ),
          ),
          child: AppCard(
            padding: 16,
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Brand.surface2,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    e.installedAt == null
                        ? Icons.sim_card_download_outlined
                        : Icons.sim_card,
                    color: e.installedAt == null ? Brand.warn : Brand.accent,
                    size: 21,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Pill(e.isFreeTier ? 'Free tier' : 'Paid',
                              highlight: e.isFreeTier),
                          const SizedBox(width: 8),
                          Text(
                            e.installedAt == null ? 'Not installed' : 'Installed',
                            style: const TextStyle(
                                fontSize: 12.5, color: Brand.muted),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        // Only the tail is useful to a human, and a full ICCID
                        // on screen is 20 digits of noise.
                        // Guarded: a short or empty iccid from a malformed row
                        // would throw RangeError during build and take the
                        // whole list down with it.
                        e.iccid.length <= 6
                            ? e.iccid
                            : '••• ${e.iccid.substring(e.iccid.length - 6)}',
                        style: const TextStyle(
                            fontSize: 13,
                            color: Brand.text,
                            fontFeatures: [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Brand.muted),
              ],
            ),
          ),
        ),
      );
}
