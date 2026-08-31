import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../brand.dart';
import '../services/esim_service.dart';
import '../widgets/common.dart';

/// eSIM installation.
///
/// Three routes onto a handset, in descending order of how many users actually
/// complete them:
///
///  1. **Universal link** — one tap into the OS eSIM installer. This is the
///     single biggest conversion lever in the whole funnel and costs nothing.
///  2. **Manual entry** — SM-DP+ address and activation code, typed. Ugly, but
///     it is the only thing that works on older Androids, and it converts the
///     users who would otherwise open a support ticket.
///  3. **Copy the raw LPA string** — for anyone helping them over the phone.
///
/// A QR code is deliberately *not* the hero here: it is useless on the device
/// displaying it, which is the device most people are reading this on. Most
/// competitors still lead with one.
class InstallScreen extends StatefulWidget {
  const InstallScreen({super.key, required this.api, required this.iccid});
  final ApiClient api;
  final String iccid;

  @override
  State<InstallScreen> createState() => _InstallScreenState();
}

class _InstallScreenState extends State<InstallScreen> {
  EsimDetail? _esim;
  Object? _error;
  bool _launching = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final e = await widget.api.esim(widget.iccid);
      if (mounted) setState(() => _esim = e);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _install() async {
    final esim = _esim;
    if (esim == null) return;
    setState(() => _launching = true);
    try {
      final ok = await EsimService.installViaUniversalLink(
        esim.activationCode,
        isIOS: Platform.isIOS,
      );
      if (!ok && mounted) {
        // Not an error to hide — it is the cue to use manual entry. Older
        // Android builds and pre-17.4 iOS just open a browser page.
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                "This phone can't open the install link. Use the manual details below."),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    HapticFeedback.selectionClick();
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$label copied')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.bg,
      appBar: AppBar(
        backgroundColor: Brand.bg,
        surfaceTintColor: Colors.transparent,
        foregroundColor: Brand.text,
        title: const Text('Install your eSIM',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
      ),
      body: _error != null && _esim == null
          ? ErrorState(onRetry: _load, detail: _error.toString())
          : _esim == null
              ? const Loading()
              : _body(_esim!),
    );
  }

  Widget _body(EsimDetail esim) {
    final parts = EsimService.parseLpa(esim.activationCode);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 40),
      children: [
        const Text(
          'Do this while you still have WiFi. Downloading the profile needs a '
          'connection, and the whole point is that you will not have one when '
          'you land.',
          style: TextStyle(fontSize: 15, color: Brand.muted, height: 1.5),
        ),
        const SizedBox(height: 20),

        if (esim.usage != null) ...[
          AppCard(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Data remaining',
                        style: TextStyle(fontSize: 13, color: Brand.muted)),
                    const SizedBox(height: 4),
                    Text('${esim.usage!.remainingMb} MB',
                        style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: Brand.accent,
                            fontFeatures: [FontFeature.tabularFigures()])),
                  ],
                ),
                Pill(esim.usage!.status.replaceAll('_', ' ')),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('One tap install',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Brand.text)),
              const SizedBox(height: 6),
              const Text(
                'Make sure you are on the phone that will use this eSIM.',
                style: TextStyle(fontSize: 14, color: Brand.muted, height: 1.5),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Install now',
                busy: _launching,
                onTap: _install,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Or enter manually',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Brand.text)),
              const SizedBox(height: 6),
              const Text(
                'Settings → Mobile → Add eSIM → Enter details manually. Works on '
                'every device, including older Androids.',
                style: TextStyle(fontSize: 14, color: Brand.muted, height: 1.5),
              ),
              const SizedBox(height: 14),
              // Spelled exactly as the handset spells it in Settings. This is
              // the one label in the app that must not be tidied: it is a value
              // the user matches against their own screen while typing.
              _copyRow('SM-DP+ address', parts?.smdp ?? esim.smdpAddress),
              const SizedBox(height: 10),
              _copyRow('Activation code', parts?.matchingId ?? esim.matchingId),
              const SizedBox(height: 10),
              _copyRow('ICCID', esim.iccid),
              const SizedBox(height: 10),
              _copyRow('Full LPA string', esim.activationCode, mono: true),
            ],
          ),
        ),
        const SizedBox(height: 12),

        const Note(EsimService.roamingReminder, tone: NoteTone.warn),
      ],
    );
  }

  Widget _copyRow(String label, String value, {bool mono = false}) =>
      GestureDetector(
        onTap: () => _copy(value, label),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Brand.surface2,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label.toUpperCase(),
                        style: const TextStyle(
                            fontSize: 10,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w600,
                            color: Brand.muted)),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: mono ? 11.5 : 14,
                        color: Brand.text,
                        fontFamily: mono ? 'monospace' : null,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const Icon(Icons.copy_rounded, size: 17, color: Brand.muted),
            ],
          ),
        ),
      );
}
