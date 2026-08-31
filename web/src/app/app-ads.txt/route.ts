import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * app-ads.txt — served from the site root at /app-ads.txt.
 *
 * This is the IAB "Authorized Sellers for Apps" file. It declares which ad
 * networks are permitted to sell your inventory, and it exists because
 * spoofing app inventory is trivial otherwise: anyone can claim to be your app
 * in a bid request and pocket the spend.
 *
 * Two reasons it is not optional for this product:
 *
 *  1. AdMob requires app verification via app-ads.txt before full ad serving.
 *     Without it you sit in limited serving, which for a business whose entire
 *     free tier is funded by ad revenue means a permanently depressed eCPM.
 *  2. Buyers increasingly filter unverified inventory outright. Missing this
 *     file does not merely risk fraud — it removes you from demand.
 *
 * Requirements to get it working:
 *  - The domain here must EXACTLY match the developer website URL on your Play
 *    Store listing. A mismatch (www vs apex, http vs https) means AdMob never
 *    finds it, and the console reports "not found" with no further explanation.
 *  - Allow at least 24 hours after publishing for the crawl.
 *
 * Served as a route rather than a static file so the publisher id comes from
 * env and cannot drift between environments.
 */
export function GET() {
  const pubId = process.env.ADMOB_PUBLISHER_ID ?? "pub-0000000000000000";

  const lines = [
    "# Authorized Sellers for Apps (IAB Tech Lab)",
    "# Any network permitted to sell this app's inventory must be listed here.",
    "",
    `google.com, ${pubId}, DIRECT, f08c47fec0942fa0`,
    "",
    "# Add mediation partners below as you onboard them, e.g.:",
    "# unityads.unity3d.com, 1234567, DIRECT",
    "# applovin.com, abc123, DIRECT",
  ];

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // AdMob re-crawls periodically; a day of cache is plenty and keeps the
      // origin quiet.
      "cache-control": "public, max-age=86400",
    },
  });
}
