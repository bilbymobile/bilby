/**
 * Rewarded-ad bridge.
 *
 * One interface, three implementations, chosen at runtime:
 *
 *   native  — Capacitor + @capacitor-community/admob. The real thing.
 *   web     — no rewarded inventory exists on the mobile web. Explains why
 *             rather than pretending, and points at the app.
 *   dev     — local simulation, hard-gated to non-production.
 *
 * Why not a Trusted Web Activity: a TWA renders fullscreen under Chrome's
 * control, so native views like AdMob's cannot be overlaid on it. There is no
 * officially supported way to show AdMob banner or rewarded ads in a TWA, and
 * injecting web ads into the wrapped page risks an AdMob policy violation.
 * Since the rewarded ad IS the product, that rules TWA out — hence Capacitor,
 * which runs the same web build inside a WebView you control and can overlay
 * native ad views on.
 *
 * The critical detail in this whole file is `ssv.userId`. The reward is NOT
 * granted by anything that happens here. This code asks for an ad; Google's
 * servers independently call your SSV endpoint and that is what moves the
 * ledger. Passing the signed user id is the only thing tying the two together.
 */

export type AdEnvironment = "native" | "web" | "dev";

export interface AdOutcome {
  /** The user finished the ad. Advisory only — the ledger moves via SSV. */
  completed: boolean;
  reason?: "no_fill" | "dismissed" | "error" | "unsupported";
  message?: string;
}

interface CapacitorAdMob {
  initialize(opts: { requestTrackingAuthorization?: boolean }): Promise<void>;
  prepareRewardVideoAd(opts: {
    adId: string;
    isTesting?: boolean;
    ssv?: { userId?: string; customData?: string };
  }): Promise<unknown>;
  showRewardVideoAd(): Promise<{ type: string; amount: number }>;
}

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

let admob: CapacitorAdMob | null = null;
let initialised = false;

export function adEnvironment(): AdEnvironment {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
    return "native";
  }
  return process.env.NODE_ENV === "production" ? "web" : "dev";
}

async function ensureNativeAdMob(): Promise<CapacitorAdMob> {
  if (admob && initialised) return admob;

  // Dynamic import so the web bundle never pulls in a native-only module.
  // A static import here would break `next build` for the web deployment.
  const mod = await import(
    /* webpackIgnore: true */ "@capacitor-community/admob"
  ).catch(() => null);

  if (!mod) throw new Error("AdMob plugin unavailable");
  admob = (mod as unknown as { AdMob: CapacitorAdMob }).AdMob;

  if (!initialised) {
    // requestTrackingAuthorization is an iOS ATT concern; harmless on Android
    // and required the moment you ship an iOS build.
    await admob.initialize({ requestTrackingAuthorization: true });
    initialised = true;
  }
  return admob;
}

/**
 * Show one rewarded ad.
 *
 * @param ssvUserId The SIGNED user id from /api/me. Never a raw uuid — the SSV
 *                  callback verifies this HMAC before crediting, which is what
 *                  stops someone pointing rewards at another user's account.
 */
export async function showRewardedAd(ssvUserId: string): Promise<AdOutcome> {
  const env = adEnvironment();

  if (env === "web") {
    return {
      completed: false,
      reason: "unsupported",
      message:
        "Rewarded ads only run in the app. Install it to start earning data.",
    };
  }

  if (env === "dev") {
    const res = await fetch("/api/dev/simulate-ad", { method: "POST" });
    return { completed: res.ok, reason: res.ok ? undefined : "error" };
  }

  try {
    const ad = await ensureNativeAdMob();

    const adId =
      process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID ??
      // Google's official rewarded test unit. Using a real unit during
      // development is how accounts get suspended for invalid traffic —
      // never point a debug build at production inventory.
      "ca-app-pub-3940256099942544/5224354917";

    await ad.prepareRewardVideoAd({
      adId,
      isTesting: process.env.NEXT_PUBLIC_ADMOB_TESTING === "true",
      // THE important line. Google echoes this back to /api/ads/ssv.
      ssv: { userId: ssvUserId },
    });

    await ad.showRewardVideoAd();

    // Completion is a UI signal only. We return it so the client can show a
    // spinner and re-poll /api/me — the actual credit arrives out-of-band,
    // typically within a second or two, occasionally longer.
    return { completed: true };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/no fill|no ad/i.test(msg)) {
      return {
        completed: false,
        reason: "no_fill",
        message: "No ad available right now. Try again in a moment.",
      };
    }
    return { completed: false, reason: "error", message: msg };
  }
}

/**
 * Poll for the SSV credit after an ad completes.
 *
 * Necessary because the reward is asynchronous: the ad closes on the device
 * while Google's callback is still in flight to your server. Without this the
 * user sees "ad finished" and an unchanged balance, and concludes you stole it.
 *
 * Backs off and gives up rather than spinning forever — if the callback never
 * arrives, saying so is better than a permanent loading state.
 */
export async function awaitCredit(
  balanceBefore: number,
  timeoutMs = 12_000
): Promise<{ credited: boolean; balanceMb: number }> {
  const started = Date.now();
  let delay = 400;

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 2000);

    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) continue;
    const me = (await res.json()) as { balanceMb: number };

    if (me.balanceMb > balanceBefore) {
      return { credited: true, balanceMb: me.balanceMb };
    }
  }
  return { credited: false, balanceMb: balanceBefore };
}
