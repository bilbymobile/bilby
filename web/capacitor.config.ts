import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config.
 *
 * ## Why Capacitor and not a Trusted Web Activity
 *
 * The original answer was advertising: a Trusted Web Activity renders fullscreen
 * under Chrome's control, you cannot overlay a native view on it, and this
 * product was going to be funded by rewarded video. That product does not
 * exist. Bilby sells prepaid plans, there is no ad SDK in the build, and the
 * admob dependency has been removed.
 *
 * So the original reason for choosing Capacitor over a TWA is gone, and this
 * comment is not going to pretend otherwise. What remains in favour of a native
 * shell is the eSIM install handoff to the system LPA and having somewhere to
 * put an offline screen. Both are real and neither is the argument that was
 * made here.
 *
 * This is worth deciding rather than inheriting. The Expo app is the Android
 * plan now; whichever shell ships, it should ship because somebody chose it.
 *
 * ## Why server.url instead of a bundled build
 *
 * This app has server routes, so it cannot be statically exported into the APK.
 * The native shell loads the live deployment.
 *
 * The trade off, stated plainly: Play reviewers apply a minimum functionality
 * bar to apps that are "just a website in a wrapper". What clears it here is
 * the eSIM install handoff to the system LPA and the plan library, so make
 * those visible in the store listing rather than describing the app as a web
 * wrapper. Also expect the app to need connectivity to start, which is ironic
 * for a connectivity product; ship an offline screen that explains it.
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
