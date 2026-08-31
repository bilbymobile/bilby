# nesim — reference implementation

An ad-funded free-tier travel eSIM, built so it runs end to end **today** with
no credentials, no supplier contract, and no money in anybody's wallet.

```bash
npm install
cp .env.example .env.local          # then set SESSION_SECRET
npm run dev                         # http://localhost:3000
```

Out of the box `PAID_SUPPLIER` and `FREE_SUPPLIER` are both `mock`. Nothing
real is provisioned and no money moves. Swap them for `airalo` / `esimaccess`
when you have keys.

---

## The one idea

Every free-eSIM app grants a **flat** amount of data per rewarded ad — Firsty
gives 20 MB, or 30 minutes, everywhere on earth. That is a structural bug,
because the two sides of the trade move independently:

| | Range | Driven by |
|---|---|---|
| Rewarded-video eCPM | ~$1 – $30 | who the advertiser is buying |
| Wholesale roaming data | ~$0.40 – $2.80 / GB | where the handset physically is |

A flat rate prints money in one market and bleeds in another, and an aggregate
P&L cannot tell you which. `src/lib/pricing.ts` instead solves for MB on every
grant so that **every single ad view is contribution-positive by construction**:

```
grantMb = (revenuePerView × (1 − targetMargin)) / costPerMb(destination)
```

Run `npx tsx scripts/economics.test.ts` — it fails the build if any region is
ever enabled while underwater.

### The traveller arbitrage

Falls straight out of the model. Data costs what the **destination** costs. Ad
inventory is priced on the audience the advertiser thinks it is buying, which
tracks the user's **home market**. So an Australian in Bali is a Tier‑1
audience consuming Tier‑3‑cost data:

| AU traveller in | destination-only pricing | traveller-aware | free tier |
|---|---:|---:|---|
| Indonesia | 5 MB (loss) | **6 MB** | flips to viable |
| Thailand | 5 MB (loss) | **6 MB** | flips to viable |
| Japan | 5 MB | **6 MB** | viable |
| UK | 8 MB | **9 MB** | viable |

This is a *hypothesis with a number attached*, not a measurement.
`HOME_MARKET_RETENTION` (default `0.4`) is the knob. Segment AdMob reporting by
device country vs app-store country in week one and set it to what you measure.
If it turns out to be zero the model degrades gracefully to destination-only
pricing and you have lost nothing.

---

## Four brakes between a tap and your wallet

Free data is an unbounded promise; a supplier wallet is a bounded number.

1. **Exactly-once ad crediting** — a unique partial index on the ad transaction
   id. AdMob retries SSV on timeout; a naive handler pays twice.
2. **Per-user daily cap** (`DAILY_AD_CAP`) — bounds one user.
3. **Global daily budget** (`DAILY_BUDGET_USD`) — bounds *everyone*. Reserved at
   grant time, not redemption time. This is the real brake, and it is a blast
   radius, not a growth target.
4. **Redemption threshold** (`REDEMPTION_THRESHOLD_MB`) — credits accrue
   instantly but data is only bought from the supplier in supplier-sized units.
   Expect 40–60% of credits to never be redeemed; at low volume that breakage is
   most of your margin.

> **Invariant:** keep `REDEMPTION_THRESHOLD_MB ≤ smallest regional grant ×
> DAILY_AD_CAP`, or users in your weakest market can never reach it in a day.

---

## Security: the rewarded-ad callback

`src/lib/admob-ssv.ts` is the most important file here. Without it your reward
endpoint is an unauthenticated way for anyone with `curl` to mint data.

- Verification is ECDSA-SHA256 over the **raw query string**, sliced at
  `&signature=`. Re-serialising from `URLSearchParams` re-encodes and reorders,
  and every verification silently fails.
- Client-side "I finished the ad" events are UI hints. They never move the
  ledger.
- Key-server outages return **503** (retryable), forged callbacks return **403**.
  Confusing the two either discards real earnings during a blip or accepts
  forgeries.

`npx tsx scripts/verify-ssv.test.ts` stands up a P-256 key pair, stubs the key
server, and proves a post-signing tamper of `reward_amount` is rejected.

---

## Layout

```
src/lib/pricing.ts         ad↔data exchange engine, traveller arbitrage
src/lib/ledger.ts          append-only credits, caps, global budget guard
src/lib/admob-ssv.ts       rewarded-ad signature verification
src/lib/suppliers/         Supplier interface + airalo / esimaccess / mock
src/lib/db.ts              SQLite schema (append-only credit_ledger)
src/app/api/ads/ssv        the ONLY path that creates credits
src/app/api/redeem         the ONLY path that spends money
src/app/ops                live economics — watch contributionUsd daily
```

### Why two suppliers

The paid catalogue and the free tier have incompatible requirements:

- **Paid** needs catalogue breadth and brand trust. Airalo is ideal — €0 setup,
  900+ packages — but it enforces a **minimum selling price equal to Airalo
  retail**. You may not undercut the company you resell.
- **Free** needs *ICCID-scoped micro top-ups* and no price floor. "Free" is by
  definition below Airalo's floor, and if each grant required provisioning a
  whole new profile the user would reinstall every time they ran dry.

`freeSupplier()` hard-fails on a supplier whose `supportsMicroTopUp` is false,
rather than silently buying a 1 GB bundle to satisfy a 20 MB reward — a ~50x
cost overrun that would not surface until the invoice.

---

## Payments and the Play Store

Google Play's Payments policy exempts purchases *consumed outside* a
Play-distributed app. Mobile connectivity is consumed by the handset's modem,
not inside the app, which is the basis on which eSIM apps take card payments
directly rather than through Play Billing at 15%.

It is an **interpretation**, not a written eSIM carve-out. Reduce the risk:
keep checkout on the web, link out rather than embed, and never gate app
features behind a purchase — that last one is what turns a data plan into an
in-app digital good.

---

## Android

**Capacitor, not a Trusted Web Activity.** A TWA renders fullscreen under
Chrome's control, so native views cannot be overlaid on it — there is no
officially supported way to show AdMob rewarded ads in a TWA, and injecting web
ads into the wrapped page risks an AdMob policy violation. Since the rewarded ad
*is* the product, TWA is ruled out.

The Capacitor shell (`android/`) loads the live deployment and adds the AdMob
rewarded SDK. The `user_id` passed to `prepareRewardVideoAd({ ssv: { userId } })`
must be the **signed** value from `/api/me` (`ssvUserId`) so the out-of-band SSV
callback can attribute the reward without trusting the client.

Targets API 36 — required for new Play apps from 31 August 2026.
See `../DEPLOY.md` for the full path.

Universal links work on both platforms and are the single biggest conversion
lever in the install funnel:

```
iOS 17.4+   https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=<LPA>
Android 10+ https://esimsetup.android.com/esim_qrcode_provisioning?carddata=<LPA>
```

Same parameter, same payload, different host. Always also offer a QR code and
manual SM-DP+ / activation-code entry — that is what converts older devices
instead of generating support tickets.

---

## Tests

```bash
npx tsx scripts/verify-ssv.test.ts    # 5 assertions — ad callback crypto
npx tsx scripts/economics.test.ts     # 11 assertions — free-tier invariants
```

## Status

The supplier adapters are written against published API documentation and are
**not yet exercised against live credentials**. Treat `airalo.ts` and
`esimaccess.ts` as informed first drafts: expect to adjust field names on first
contact with a real sandbox. `mock.ts` and everything above it are tested.
