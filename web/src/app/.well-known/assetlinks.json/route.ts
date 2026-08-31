import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";

/**
 * Digital Asset Links — served at /.well-known/assetlinks.json
 *
 * Declares that this domain and the Android app are operated by the same
 * party, proven by the app's signing-certificate SHA-256 fingerprint.
 *
 * Why it matters here even though Capacitor does not strictly require it:
 *
 *  - It enables Android App Links, so a link to an eSIM install page opens
 *    your app instead of a browser tab. In a product whose core flow is
 *    "tap link → install profile", that is a direct conversion win.
 *  - It is what makes Google Password Manager / autofill trust the pairing.
 *  - If you later add a TWA surface or web-to-app handoff, it is prerequisite.
 *
 * Getting the fingerprint — use the key Play actually signs with:
 *
 *   Play Console → Test and release → Setup → App signing
 *     → "SHA-256 certificate fingerprint" (App signing key, NOT upload key)
 *
 * Using the upload key here is the single most common mistake: everything
 * works in local debug builds and silently fails for every real user, because
 * Play re-signs your bundle with a different key.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const statements = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: brand.androidPackage,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(statements, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
