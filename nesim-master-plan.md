# nesim — building a free-tier travel eSIM from zero

**Prepared 14 August 2026 · Market: Australia/New Zealand outbound · Strategy: free tier first, ad-funded**

---

## Before anything else: the honest version

You asked for zero investment and a free eSIM. Here is what the research
actually supports, stated plainly, because a plan built on a comfortable
answer is worth nothing.

**What is genuinely free:** the software, the infrastructure, the distribution,
the Airalo/Saily affiliate revenue stream, and the entire product you now have
running. All of it. Real cost to launch: **A$0 plus the Play Console account you
already own.**

**What is not free:** *data*. Every supplier that will give you an API wants a
prepaid wallet. MobiMatter asks **$250** to activate an approved account.
eSIM Go's entry tier is **$0/month commitment but a $1,000 minimum top-up for
the first three months**. Nobody in this industry extends credit to a new
counterparty, and they are right not to.

**And the number that matters most**, which the pricing engine in your codebase
computed rather than assumed:

> At starter volume, one rewarded ad view in Australia earns about **$0.0162**
> after fill. One megabyte of Oceania roaming data costs about **$0.00215**.
> After holding back a 35% buffer, one ad funds **4.9 MB**. That is not a
> product. It is a rounding error with a loading spinner.

This is why Firsty — the model you named — raised **€1.1M pre-seed and then
€5.1M seed led by Speedinvest** before scaling their free tier, and why their
free tier delivers roughly **0.05 Mbps**, which TechRadar politely describes as
suitable for messaging and email. Firsty's free tier is not a profitable
product. It is venture-funded customer acquisition for a €1/day paid product.

So the strategy below does not pretend the free tier pays for itself on day
one. It does something better: it makes the free tier **structurally incapable
of costing you more than a number you choose in advance**, and it finds the one
segment where the economics genuinely do work at starter volume.

---

## 1. The finding that changes the plan

### 1.1 Everyone prices this wrong

Firsty and every clone use a **flat** exchange rate: one ad = 20 MB, or one ad =
30 minutes, anywhere on earth. Both sides of that trade move independently.

| | Spread | Set by |
|---|---|---|
| Rewarded video eCPM | ~$2 → ~$30 (≈15x) | who the advertiser thinks they're buying |
| Wholesale roaming data | $0.40 → $2.80 per GB (7x) | where the handset physically is |

A flat rate therefore prints money in one market and bleeds in another, and an
aggregate P&L cannot tell you which is happening. Your `pricing.ts` solves for
MB on every grant instead:

```
grantMb = (revenuePerView × (1 − 0.35)) / costPerMb(destination, volumeTier)
```

Every ad view is contribution-positive **by construction**, everywhere, or the
region is served paid-only. Here is what that yields at starter volume:

| Region | Revenue/view | Grant | Contribution/view | Free tier |
|---|---:|---:|---:|---|
| North America | $0.0202 | 9 MB | +$0.0079 | **ON** |
| Western Europe | $0.0141 | 8 MB | +$0.0055 | **ON** |
| East Asia | $0.0119 | 5 MB | +$0.0046 | **ON** |
| Oceania | $0.0162 | 5 MB | +$0.0055 | paid only |
| MENA | $0.0049 | 5 MB | −$0.0039 | paid only |
| Southeast Asia | $0.0025 | 5 MB | −$0.0014 | paid only |
| South Asia | $0.0014 | 5 MB | −$0.0034 | paid only |
| Sub-Saharan Africa | $0.0011 | 5 MB | −$0.0126 | paid only |

Read that table and the business looks dead. The free tier works in rich
countries; Australians fly to **Indonesia, Thailand, Vietnam and Japan**.

### 1.2 The traveller arbitrage

Then look again at what drives each column.

**Data cost** is set by where the handset physically is. A megabyte consumed in
Bali costs Southeast Asia rates. Nothing changes that.

**Ad revenue** is set by who the advertiser thinks they are buying — locale,
language, app-store account country, device tier, historical signals. Not purely
the IP the request arrived from.

An Australian in Bali is a **Tier-1 audience consuming Tier-3-cost data**.

That gap is not a rounding error. Modelled at 40% home-market retention:

| AU traveller in | Destination-only | Traveller-aware | Free tier |
|---|---:|---:|---|
| Indonesia | 5 MB (−$0.0014) | **6 MB (+$0.0033)** | dead → **viable** |
| Thailand | 5 MB (−$0.0014) | **6 MB (+$0.0033)** | dead → **viable** |
| Vietnam | 5 MB (−$0.0014) | **6 MB (+$0.0033)** | dead → **viable** |
| Japan | 5 MB | **6 MB (+$0.0048)** | viable |
| UK / Italy | 8 MB | **9 MB (+$0.0053)** | viable |

**This is the strategic reason to build for AU/NZ outbound specifically**, and
it is a far better reason than "it's your home market." You are not competing
with Airalo on price in Indonesia. You are monetising an audience Airalo cannot
see, in a market where data is cheap.

It is implemented (`quoteTravellerGrant`), tested, and running. A local
Indonesian user gets 5 MB and no free tier; an Australian standing next to them
gets 6 MB and a free tier. Verified end to end.

**Treat this as a hypothesis with a number attached, not a measurement.**
`HOME_MARKET_RETENTION` defaults to a deliberately pessimistic 0.4. Measure it
in week one: segment AdMob reporting by device country vs app-store country and
compare realised eCPM for AU-account users abroad against local users. If it is
zero, the code degrades to destination-only pricing and you have lost nothing.
If it is 0.5, this is a different and much larger business.

---

## 2. Where you plug into the value chain

```
MNO (Telstra, Telkomsel…)  ← owns spectrum. Not reachable.
  └─ MVNE/MVNA             ← owns SM-DP+, IMSI ranges. $50k–$250k+ commitments.
      └─ eSIM aggregator   ← Airalo, eSIM Access, eSIM Go, MobiMatter, Telnyx
          └─ YOU           ← app, brand, pricing, ad layer, customer
```

Layers below the aggregator require capital you do not have and add nothing a
user can see. **Stay at the reseller layer indefinitely.** Airalo itself was a
reseller for years. The defensible asset is the pricing engine, the ad layer
and the customer relationship — not an SM-DP+.

### 2.1 Supplier comparison

| Supplier | Setup | Monthly | Wallet to start | Micro top-up | Price floor | Verdict |
|---|---|---|---|---|---|---|
| **Airalo Partners** | €0 | €0 | not published | ✗ | **= Airalo retail** | Paid catalogue, day one |
| **eSIM Access** | €0 | €0 | low | **✓ ICCID top-up** | none | **Free tier supply** |
| **MobiMatter** | €0 | €0 | **$250** | partial | none | Solid fallback |
| **Celitech** | €0 | €0 | rev-share | ? | none | Worth a call |
| **Telnyx** | €0 | €0 | self-serve | ✓ | none | Best API, thinner travel catalogue |
| **eSIM Go** | $0 | $0 | **$1,000/3mo** | ✓ | none | Only once revenue exists |
| **Mobilise / BNESIM** | €10k–€40k | €500–€1,500 | — | — | — | Not for years |

**The Airalo trap.** Airalo is the obvious first supplier — €0/€0, 900+
packages, 200+ destinations, real sandbox, brand trust that reduces your support
load. But Airalo enforces a **minimum selling price equal to Airalo's own retail
price**. You are contractually forbidden from undercutting the company you are
reselling. Fine for bundle resale; **fatal for a free tier**, because free is by
definition below their floor.

**Why micro top-ups decide everything.** If each grant requires provisioning a
*new* eSIM profile then: the user reinstalls every time they run dry (nobody
does this twice), you pay a profile-issuance fee per grant, and you cannot grant
less than the smallest sellable bundle — usually 1 GB, roughly 50x more than one
ad view can fund. eSIM Access's **ICCID-scoped top-up** (`TOPUP_` package codes
against an existing profile) is what makes "install once, top up forever"
possible. That single API capability is the whole free tier.

Your `freeSupplier()` hard-fails on a supplier whose `supportsMicroTopUp` is
false rather than silently buying a gigabyte to satisfy a 20 MB reward.

---

## 3. The actual zero-capital sequence

You chose free-tier-first. That is the highest-ceiling path and the one with a
real working-capital gap, so here is the bridge, precisely.

**The gap:** AdMob accrues revenue continuously but pays around day 21–30 after
month end. Suppliers want money before they ship data. So for your first ~50
days you owe a supplier cash you have not been paid yet.

**The bridge — four moves, none of which cost anything:**

### Move 1 · Days 1–14 — Affiliate revenue as seed capital

Join the **Airalo affiliate programme via Impact**: 10% of final sale value,
$15 payout threshold, paid monthly on the 28th. Zero cost, zero wallet, no
integration. Put a genuinely useful **"cheapest eSIM for your trip" comparison
tool** on the web app — real utility, ranks in search, converts.

This is not a side hustle. It is your supplier wallet. ~$250 of affiliate
commission is a MobiMatter account. ~$1,000 is eSIM Go.

### Move 2 · Days 1–30 — Ship the app with ads live and the free tier *queued*

Publish to Play with the earn loop running and AdMob live. Users watch ads and
accrue credits immediately. **Credits are only converted into real data once a
user crosses `REDEMPTION_THRESHOLD_MB`.**

This is not a trick — it is the same mechanic every airline loyalty scheme uses,
and it does three things at once:

- Ad revenue accrues **before** any data is bought. The float runs in your favour.
- **40–60% of accrued credits are never redeemed.** At starter volume that
  breakage *is* your free-tier margin.
- You gather real eCPM data before you have spent a cent on data — which is
  exactly what you need to calibrate `HOME_MARKET_RETENTION`.

### Move 3 · Day ~30 — First wallet, from money you did not have

Affiliate commission + accrued ad revenue funds a MobiMatter or eSIM Access
wallet. Flip `FREE_SUPPLIER` from `mock`. Redemptions go live.

### Move 4 · Day ~60+ — Own the paid catalogue

Once you clear ~500 activations/month, the wholesale ladder moves from starter
($1.80–$2.20/GB) to growth ($1.30–$1.70/GB), which nearly doubles every free
grant and turns Oceania and East Asia on.

### The budget guard is what makes this safe

`DAILY_BUDGET_USD` defaults to **$5**. A hard global ceiling on free-tier data
spend per UTC day, reserved at grant time. Hit it and the free tier degrades to
a polite "back tomorrow"; paid is untouched.

Set it to a number you could lose today without it mattering. It is a blast
radius, not a growth target. This is the difference between a viral moment being
the best day of your life and an unpayable invoice.

---

## 4. Product design

### 4.1 Positioning

Firsty's free tier is ~0.05 Mbps and requires re-watching an ad every 30–60
minutes to stay connected — which reviewers consistently call out as the
annoying part. That is your opening.

> **"Land connected. Maps and messages are free, forever. Pay $1 only on the
> days you want everything else."**

Do not compete on gigabytes. Compete on **the first twenty minutes after the
plane lands** — the moment you need a rideshare, a hotel address and a message
to say you arrived, and have no connectivity to arrange any of it.

### 4.2 Tier structure

| Tier | What | Price | Purpose |
|---|---|---|---|
| **Free** | 6–9 MB per ad, ~10 ads/day, capped ~60–90 MB/day | $0 | Acquisition + retention |
| **Day pass** | 1 GB full speed, 24h | ~$1.50 | The volume seller |
| **Trip pass** | 3–10 GB, 7–30 days | $6–$20 | The margin |
| **Hotspot** | Tethering unlock | +$1/day | Pure margin, zero cost |

Firsty benchmarks at €1/day for 1 GB (Comfort Plus) and €2.50/day for 5 GB
(First Class). At 45% target margin your day pass lands near theirs — so do not
undercut. **Undercut on the free tier instead**, where your pricing engine gives
you a real structural advantage over their flat rate.

### 4.3 Retention

The install-once profile is the moat. Once your eSIM is on a traveller's phone
and topping up silently, the switching cost to Airalo is a fresh QR scan and a
new profile every single trip. Your `esims` table enforces one free-tier profile
per user forever, topped up rather than reissued.

---

## 5. Technical build

Everything below is written, building clean, and smoke-tested.

### 5.1 Stack, all on free tiers

| Layer | Choice | Cost |
|---|---|---|
| Web app | Next.js 15 (App Router) | $0 |
| Hosting | Vercel / Cloudflare free tier | $0 |
| Database | SQLite → Postgres at ~100k users | $0 |
| Ads | AdMob rewarded | $0 |
| Payments | Stripe (2.9% + 30¢) | $0 fixed |
| Android | TWA wrapping the web app + native AdMob | $0 |

### 5.2 The install flow — biggest conversion lever in the funnel

Three routes, in descending order of completion:

```
iOS 17.4+   https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=<LPA>
Android 10+ https://esimsetup.android.com/esim_qrcode_provisioning?carddata=<LPA>
```

Same parameter, same LPA payload, different host. One tap into the OS installer.
Costs nothing to add and most competitors still lead with a QR code — which is
useless on the device displaying it. Then QR for second devices, then manual
SM-DP+ entry, which is the only thing that works on older Androids.

The most common support ticket in this entire category is **"it says no
service"** — because the user did not enable data roaming on a roaming profile.
Your install page says so before they ask.

### 5.3 Security: the ad callback is the whole attack surface

`admob-ssv.ts` is the most important file in the codebase. Without it your
reward endpoint is an unauthenticated way for anyone with `curl` to mint data
against your wallet.

- ECDSA-SHA256 over the **raw query string**, sliced at `&signature=`.
  Re-serialising from `URLSearchParams` re-encodes and reorders — every
  verification then silently fails.
- Client-side "ad finished" events never move the ledger.
- Key-server outage → **503** (retryable). Forged callback → **403**. Confusing
  these either discards real earnings during a blip or accepts forgeries.

Proven by test: a post-signing tamper of `reward_amount` from `1` to `5000` is
rejected. 5/5 passing.

### 5.4 The ledger is append-only

`credit_ledger` is never UPDATEd and never DELETEd from; balance is a SUM.
Non-negotiable for anything converting user actions into money — the day someone
farms rewards you must prove exactly what was granted, when, from which
impression, and reverse precisely that. A mutable `users.balance_mb` column
cannot answer a single one of those questions.

### 5.5 What is tested vs what is not

**Tested and working:** pricing engine (11 assertions across 4 volume tiers),
SSV crypto (5 assertions), earn → cap → redeem → install flow end to end, budget
guard tripping at $5 after 40 simulated users and 409 views, per-user daily cap,
duplicate-transaction rejection, traveller arbitrage.

**Not yet exercised against live credentials:** the Airalo and eSIM Access
adapters. They are written against published API docs and are informed first
drafts. Expect to adjust field names on first contact with a real sandbox. This
is flagged in the README rather than buried.

---

## 6. Compliance — the parts that can actually stop you

### 6.1 Google Play payments

Play's Payments policy exempts purchases **consumed outside** a Play-distributed
app. Mobile connectivity is consumed by the handset's modem, not inside your
app. That is the basis on which eSIM apps take card payments directly instead of
paying Play Billing's 15%.

It is an **interpretation**, not a written eSIM carve-out. Reduce the risk:

- Keep checkout on the web. Link out; do not embed.
- **Never gate app features behind a purchase.** That is what converts a data
  plan into an in-app digital good and pulls you inside the policy.
- The free tier and ads sit entirely inside the app. Only data purchase leaves.

Worst case is 15% of paid revenue, not a ban — but 15% of a 45% margin is a
third of your profit, so get the structure right the first time.

### 6.2 Australian telecommunications law — do not skip this

Australia introduced a **telco registration scheme** in 2025. Registrable
carriage service providers — those required to join the Telecommunications
Industry Ombudsman scheme — must register with ACMA. Maximum civil penalties
rose from **$250,000 to ~$10 million** (or 3x benefit, or 30% of adjusted
turnover, whichever is greatest).

Whether reselling *foreign roaming data* to Australian consumers makes you a CSP
is genuinely unsettled and depends on how the supplied service is characterised.
**This is the one item on this entire plan worth paying a lawyer for.** A
one-hour consult with an Australian telco/comms lawyer before you take your
first dollar is the cheapest insurance available. Do not accept my reading, and
do not accept a forum's.

Independently of that: Australian Consumer Law applies regardless. Clear terms,
honest coverage claims, a working refund path. "Unlimited" that is not unlimited
is where the ACCC starts.

### 6.3 Privacy

You are handling location-adjacent data (country), device identifiers and an ad
ID. Australian Privacy Act applies; GDPR applies to European travellers. Publish
a real privacy policy — Play requires a Data Safety declaration and a
mismatch between declaration and behaviour is a removal, not a warning.

---

## 7. First 90 days

### Days 1–14 · Foundations, $0

- [ ] Register a business name and domain
- [ ] Deploy the web app (Vercel free tier)
- [ ] AdMob account + rewarded ad unit; **enable SSV and set the callback URL**
- [ ] Airalo affiliate via Impact; build the comparison tool
- [ ] Airalo Partner API **sandbox** credentials; exercise `airalo.ts`
- [ ] eSIM Access: request API access, confirm minimum wallet in writing
- [ ] **Book the telco-law consult**

### Days 15–30 · Launch the earn loop

- [ ] TWA build, Play Console internal testing track
- [ ] Data Safety declaration + privacy policy
- [ ] Ads live; free tier accruing, redemption still gated
- [ ] **Measure `HOME_MARKET_RETENTION` from real AdMob data**
- [ ] Instrument: install → first ad → 5th ad → redemption → paid conversion
- [ ] Seed 20–50 real travellers (AU travel subreddits, Facebook groups)

### Days 31–60 · Turn on real data

- [ ] Affiliate + ad revenue → first supplier wallet
- [ ] Flip `FREE_SUPPLIER`; redemptions live at **`DAILY_BUDGET_USD=5`**
- [ ] Watch `/ops` contribution daily. Negative three days running → recalibrate
- [ ] Launch the day pass; Stripe checkout on web
- [ ] Play production release

### Days 61–90 · Prove the loop

- [ ] Target: 1,000 installs, 100 redemptions, 20 paid conversions
- [ ] Raise the budget cap **only** as realised contribution justifies it
- [ ] Negotiate growth-tier wholesale at ~500 activations/month
- [ ] SEO: "eSIM for Bali from Australia", "cheap eSIM Japan Australia"

### Numbers to judge yourself against

| Metric | Target by day 90 | Why |
|---|---|---|
| Install → first ad | >60% | If low, the value prop is not landing |
| Ads per active user per day | 4–6 | Below 3, the reward is too small |
| Credit breakage | 40–60% | Below 30%, you are underwater |
| Free → paid conversion | 3–8% | The entire business |
| Realised contribution/view | > $0.002 | Negative = stop and recalibrate |
| Blended CAC | < $0.50 | Organic + ad-funded should beat paid CAC |

---

## 8. What will actually go wrong

**Ad fill in emerging markets is worse than modelled.** Southeast Asia fill runs
50–70%. Already in the model; watch it anyway.

**eCPM drops as you scale past your seed audience.** Early users are your
warmest. Assume a 20–30% decline and keep `TARGET_CONTRIBUTION_MARGIN` at 0.35
until you have 30 days of real data.

**The traveller arbitrage is smaller than 0.4.** The single biggest assumption
in the plan. Measure it in week one. Graceful degradation is already built in.

**Someone farms the free tier.** Emulators, VPNs, ad ID resets. Defences in
place: SSV signature verification, exactly-once transaction ids, per-user caps,
global budget. Add device attestation (Play Integrity API) if it becomes real.

**Google changes the payments policy.** Watch for it. Keeping checkout on web
is the hedge.

**A supplier deprecates micro top-ups.** Single point of failure for the free
tier. The `Supplier` interface exists precisely so switching is a new adapter,
not a rewrite. Have a second supplier onboarded before you need one.

---

## 9. Why this can work

Airalo is bigger, better funded and better known. Holafly outspends you.
Saily has NordVPN's distribution. Firsty has €6.2M and a two-year head start.

You are not going to out-market any of them.

What you have is a **structurally better free tier**. They price ads-to-data
flat; you price it per-region, per-traveller, contribution-positive by
construction, with a hard budget guard. That means you can offer free data in
markets where a flat-rate competitor would lose money — and refuse it in markets
where they are quietly bleeding.

That is a real edge, it is defensible because it is operational rather than
promotional, and it is already written and tested.

The free tier will not make you money in year one. It buys you users at a cost
you control to the dollar. The day passes make the money. That is the same
trade Firsty made — the difference is they needed €6.2M to make it, and you have
a budget guard that lets you make it $5 at a time.

---

## Sources

- [Firsty raises €5.1M](https://www.firsty.app/press-releases/firsty-raises-eu5-1m)
- [Firsty Free Data: Speeds and Limits](https://www.firsty.app/help/account/firsty-free-mobile-data-guide)
- [Understanding Your Firsty Free Data Limits & Usage](https://intercom.help/firstyapp/en/articles/14111480-understanding-your-firsty-free-data-limits-usage)
- [TechRadar — Firsty review](https://www.techradar.com/pro/firsty-review)
- [eSIM Monster — Firsty free plan tested](https://esim.monster/en/firsty-review/)
- [Airalo Partner API — Introduction](https://developers.partners.airalo.com/introduction-752219m0)
- [Airalo Partners — What is the minimum selling price?](https://airalopartners.zendesk.com/hc/en-us/articles/25762309395869-What-is-the-minimum-selling-price)
- [Airalo Reseller Platform](https://partners.airalo.com/solutions/resellers)
- [Airalo Affiliate Program](https://partners.airalo.com/solutions/affiliates)
- [eSIM Access — Top up with the API](https://esimaccess.com/esim-top-up-with-the-api/)
- [eSIM Access API docs](https://docs.esimaccess.com/)
- [MobiMatter Reseller Partner](https://mobimatter.com/reseller-partner)
- [eSIM Go — Pricing and features](https://esimgo.com/product/pricing/)
- [Telnyx eSIM](https://telnyx.com/products/esim)
- [White-Label eSIM Platform Pricing Compared 2026](https://bappy.dog/blog/white-label-esim-pricing-compared/)
- [Simology — Wholesale eSIM Pricing: Volume Tiers & Margins](https://simology.io/blog/wholesale-pricing-forecasting-volume-tiers-commitments-and-margins)
- [Cellesim — Tourist eSIM Price Index 2026](https://cellesim.com/en/tourist-esim-price-index-2026)
- [Playwire — AdMob eCPM Benchmarks](https://www.playwire.com/blog/admob-ecpm-benchmarks-what-publishers-should-expect)
- [RevenueFlex — App Ad Revenue Benchmarks 2026](https://revenueflex.com/blog/app-ad-revenue-benchmarks-2026/)
- [Google Play — Understanding the Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [eSIM Access — Android Universal Link for eSIM Installation](https://esimaccess.com/new-android-universal-link-for-esim-installation/)
- [Android Open Source Project — Implement eSIM](https://source.android.com/docs/core/connect/esim-overview)
- [Bird & Bird — Australia's new telco registration scheme](https://www.twobirds.com/en/insights/2025/australia/new-registration-scheme-and-enforcement-powers-sharpen-teeth-of-australias-telco-regulator)
- [ACMA — Carrier licences and carriage service providers](https://www.acma.gov.au/carrier-licences-and-carriage-service-providers)
