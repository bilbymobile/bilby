import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config.
 *
 * ## Why Capacitor and not a Trusted Web Activity
 *
 * A TWA is the usual answer for "put my web app on Play", and it would be the
 * right answer here except for one thing: a TWA renders fullscreen under
 * Chrome's control, so you cannot overlay native views on it. There is no
 * officially supported way to show AdMob rewarded ads in a TWA, and injecting
 * web ads into the wrapped page risks an AdMob policy violation.
 *
 * The rewarded ad is not a feature of this product — it IS the product. So the
 * shell has to be one that can host a native ad view. That is Capacitor.
 *
 * ## Why server.url instead of a bundled build
 *
 * This app has server routes (SSV callback, ledger, supplier calls), so it
 * cannot be statically exported into the APK. The native shell therefore loads
 * the live deployment and contributes what only native code can: the AdMob
 * rewarded SDK.
 *
 * The trade-off, stated plainly: Play reviewers apply a minimum-functionality
 * bar to apps that are "just a website in a wrapper". This one clears it —
 * native rewarded ads, and the eSIM install handoff to the system LPA — but
 * make that visible in your store listing rather than describing the app as a
 * web wrapper. Also expect the app to need connectivity to start, which is
 * ironic for a connectivity product; ship an offline screen that explains it.
 */
const config: CapacitorConfig = {
  appId: "com.bilbymobile.app",
  appName: "Bilby",

  /**
   * Required by the CLI even when loading a remote URL. Points at a minimal
   * offline fallback page, not the real app — see android/README for why that
   * page matters more than usual for a travel product.
   */
  webDir: "capacitor-shell",

  server: {
    // Set to your real deployment before building a release.
    url: process.env.CAP_SERVER_URL ?? "https://bilbymobile.com",
    // `.app` is HSTS-preloaded, so cleartext is impossible anyway. Explicit
    // here so nobody flips it on while debugging and forgets.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    // Ship the release with this false. True is a debugging convenience that
    // also lets anyone with adb inspect your app's web context.
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },

  plugins: {
    AdMob: {
      // Real IDs come from the AdMob console. Keep test IDs in debug builds —
      // pointing a debug build at production inventory is the fastest way to
      // get an AdMob account suspended for invalid traffic.
      initializeForTesting: false,
    },
  },
};

export default config;
