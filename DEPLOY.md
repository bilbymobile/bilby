# Deploy — what's ready, what isn't, and the exact order

## The honest status

| | Ready? | |
|---|---|---|
| **Web app** | **Yes, today** | Builds clean, deploys to Vercel free tier in one command. |
| **Android project** | **Configured, not compiled** | Capacitor project generated, AdMob wired, targets API 36. Needs Android Studio on your machine — no Android SDK in this environment. |
| **Brand assets** | **Yes** | Full icon set, palette, store listing copy. Wordmark + screenshots still manual. |
| **Ad revenue** | **Blocked until you're live on Play** | See the sequencing constraint below. It's the thing that reorders your plan. |
| **Payments** | **No** | Stripe checkout is not built. `/plans` lists and prices; there is no buy button. |
| **Legal pages** | **No** | Privacy policy and terms are required before Play submission. |
| **Accounts / email** | **No** | Anonymous cookie sessions only. Fine to launch; you'll want recovery before you sell anything. |

---

## The sequencing constraint that changes everything

> **AdMob will not serve ads on an app that isn't published to a store.**

Apps stay in "Getting ready" until the account has payment details, and cannot
be reviewed until they're linked to a live store listing. Approval then takes
2–3 days, during which serving is limited.

Your entire free tier is funded by ad revenue. So **you cannot earn a cent until
the app is live on Play** — which makes the affiliate bridge in the master plan
load-bearing rather than optional.

**Good news:** you have an organisation Play account with a D-U-N-S number,
which exempts you from the 12-testers-for-14-days requirement that applies to
personal accounts created after 13 November 2023. That saves roughly three
weeks. Upload → review → production is days, not weeks.

**Realistic first-ad-dollar timeline:**

```
Day 0    Deploy web, submit Play listing
Day 2-5  Play review → production
Day 5    Link app in AdMob, submit for review
Day 7-8  AdMob approved, limited serving begins
Day 8    Publish app-ads.txt → wait 24h for crawl
Day 9+   Full serving. First revenue.
Day ~40  First AdMob payout lands (net-30 after month end)
```

**You fund roughly 40 days of free-tier data before a single ad dollar arrives.**
That is exactly why `DAILY_BUDGET_USD` defaults to $5, and why you should not
raise it until money is actually in the account.

---

## 1 · Web (30 minutes)

```bash
cd web
npm install
cp .env.example .env.local
```

Set `SESSION_SECRET` to real entropy — the cookie HMAC depends on it, and a
predictable secret means forgeable user ids, which means forgeable ad credits:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Deploy:

```bash
npx vercel --prod
```

Then in the Vercel dashboard set every var from `.env.example`. **`SESSION_SECRET`
must match across all deployments** or every user is logged out on each deploy.

Point your domain at it. Verify:

- `https://yourdomain/` loads
- `https://yourdomain/app-ads.txt` returns the google.com line
- `https://yourdomain/.well-known/assetlinks.json` returns JSON

---

## 2 · AdMob (do this AFTER Play, not before)

1. Create an AdMob account and **add payment details** — apps sit in "Getting
   ready" indefinitely without them.
2. Add your app. Link it to the live Play listing.
3. Create a **Rewarded** ad unit. Copy the ad unit id and the app id.
4. Set them:
   - `NEXT_PUBLIC_ADMOB_REWARDED_ID` in Vercel
   - `admob_app_id` in `android/app/src/main/res/values/strings.xml`
   - `ADMOB_PUBLISHER_ID` in Vercel (drives `/app-ads.txt`)
5. **Enable server-side verification.** AdMob → your rewarded ad unit →
   Server-side verification → callback URL:
   ```
   https://yourdomain/api/ads/ssv
   ```
   This is the only path in the app that can create credits. Without it,
   `/api/ads/ssv` never fires and nobody ever earns anything.
6. Confirm `app-ads.txt` is verified in the AdMob console. Allow 24 hours for
   the crawl. **The developer website on your Play listing must match your
   domain exactly** — www vs apex, or http vs https, and AdMob never finds it.

⚠️ Keep test ad ids in debug builds. Pointing a debug build at production
inventory is the fastest way to get an AdMob account suspended for invalid
traffic, and suspension is not easily reversed.

---

## 3 · Android

Built as a **Capacitor** app, not a Trusted Web Activity. A TWA renders
fullscreen under Chrome's control, so native views can't be overlaid on it —
there's no supported way to show AdMob rewarded ads in a TWA, and injecting web
ads into the wrapped page risks a policy violation. Since the rewarded ad *is*
the product, TWA is out.

The shell loads your live deployment and adds what only native code can: the
AdMob rewarded SDK and the eSIM install handoff.

```bash
cd web
CAP_SERVER_URL=https://yourdomain npx cap sync android
npx cap open android          # opens Android Studio
```

Already configured:

- `compileSdk` / `targetSdk` **36** — required for new apps from **31 August
  2026**, which is *17 days away*. Do not ship at 35.
- AdMob app id meta-data in the manifest
- `com.google.android.gms.permission.AD_ID` — required from Android 13. Without
  it every request looks non-personalised and eCPM collapses.
- Adaptive launcher icons at all densities
- `usesCleartextTraffic="false"`

In Android Studio: **Build → Generate Signed Bundle** → Android App Bundle.
Keep the keystore somewhere you will still have it in five years — lose it and
you cannot update the app, ever.

### Minimum-functionality risk, stated plainly

Play applies a bar to apps that are "just a website in a wrapper." This one
clears it — native rewarded ads plus the system eSIM install handoff — but
describe those native capabilities in your listing rather than presenting the
app as a web wrapper. Also ship the offline screen (`capacitor-shell/index.html`)
properly: an app that needs connectivity to open is an awkward look for a
connectivity product.

---

## 4 · Play Console

1. Create the app. Category **Travel & Local**.
2. Upload the AAB to **Internal testing** first. Install it on a real phone.
   Confirm the rewarded ad shows *and that the balance actually moves* — that
   proves the SSV loop end to end, which nothing else does.
3. Store listing — copy is in `brand/BRAND.md`.
4. Upload `brand/assets/play/icon-512.png` and the feature graphic.
5. **Data safety** — declare honestly:
   - Device or other IDs: **collected**, for advertising
   - Approximate location: **collected** (country, for pricing)
   - Data encrypted in transit: yes
   - A mismatch between declaration and behaviour is a removal, not a warning.
6. **Contains ads: Yes.** Not declaring is a removable offence.
7. Privacy policy URL — must be live and reachable before you submit.
8. Promote to production.

---

## 5 · Before you take a single dollar

- [ ] **Telco law consult.** Australia's 2025 registration scheme; penalties up
      to ~$10M. Whether reselling foreign roaming data makes you a registrable
      carriage service provider is unsettled. One hour of a comms lawyer's time.
- [ ] Trade mark search, IP Australia, classes 38 and 42.
- [ ] Privacy policy and terms actually written.
- [ ] Stripe account, and checkout built (not yet done).
- [ ] Refund policy — Australian Consumer Law applies regardless of your terms.

---

## What I'd do next, in order

1. **Legal pages + Stripe checkout.** Without these there's no revenue and no
   Play submission. This is the real blocker.
2. **Get on Play.** Everything downstream — ads, revenue, the free tier — is
   gated on being published. It costs nothing and starts a clock you can't
   start any other way.
3. **Exercise the supplier adapters against real sandboxes.** `airalo.ts` and
   `esimaccess.ts` are written from published docs and have never seen live
   credentials. Expect field-name fixes.
4. **Measure `HOME_MARKET_RETENTION`** as soon as ads are serving. It's the
   single biggest assumption in the model and one week of real data settles it.
