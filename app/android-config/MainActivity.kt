package com.bilbymobile.bilby

import android.content.Context
import android.os.Build
import android.telephony.euicc.EuiccManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Host activity.
 *
 * Copied over the generated MainActivity.kt by setup-windows.ps1. If you
 * regenerate android/ with `flutter create`, re-run that script or this file
 * goes back to the stub and the eSIM capability check silently starts
 * returning "unknown" for everybody.
 *
 * The only native code in the app: one channel answering one question.
 */
class MainActivity : FlutterActivity() {

    private val channel = "bilby/esim"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "isEsimSupported" -> result.success(isEsimSupported())
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * Can this handset install an eSIM?
     *
     * Two independent signals, because either one alone lies:
     *
     *  - `EuiccManager.isEnabled` is the authoritative runtime answer, but it
     *    needs API 28 and throws on some OEM builds that ship a stub service.
     *  - `FEATURE_TELEPHONY_EUICC` is the declared hardware feature. Present on
     *    devices with the hardware, absent on the ones we actually care about
     *    catching — budget handsets sold in South Asia and Africa that run a
     *    recent Android on hardware with no eUICC.
     *
     * We require BOTH to say yes, and return null (→ `unknown` in Dart, which
     * renders as a soft warning rather than a lockout) if we cannot ask. An
     * OS-version check is deliberately NOT used as a proxy: Android 9 shipped
     * the API in 2018, so a version test clears almost every device on earth
     * including the ones without the hardware.
     */
    private fun isEsimSupported(): Boolean? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false

        return try {
            val mgr = getSystemService(Context.EUICC_SERVICE) as? EuiccManager
                ?: return false

            val hasFeature = packageManager.hasSystemFeature(
                "android.hardware.telephony.euicc"
            )

            mgr.isEnabled && hasFeature
        } catch (e: Exception) {
            // Never let a capability probe crash the app or, worse, resolve to
            // a confident "no". Unknown is the honest answer.
            null
        }
    }
}
