# Bilby — pre-launch review

Three independent passes over the build: first-run UX, accessibility under real
travel conditions, and competitive positioning. This is the synthesis, ordered
by what it costs you to ship without it.

Read the top two sections. The rest is a work queue.

---

## The two findings that matter

### 1. Nobody could earn anything on day one

`REDEMPTION_THRESHOLD_MB` defaulted to 100 in code while every `.env` file ran
50. Development looked fine. A fresh deploy — where the env var was never set —
would have shipped the 100.

The arithmetic, checked against the pricing engine rather than assumed: the
weakest region where the free tier is switched on grants **9 MB per ad**, and the
daily cap is **10 ads**. So the absolute ceiling for a new user, anywhere on
earth, on their first day, is **90 MB against a 100 MB threshold**.

Every new user would have watched their entire daily allowance, received
nothing, and been told to come back tomorrow. Day-1 retention on that is a
rounding error, and you would never have found out whether the rest of the
product worked — the funnel dies before anyone reaches the eSIM.

**Fixed**, and more importantly made unrepeatable: `assertThresholdReachable()`
now runs the same arithmetic at module load and throws with the numbers in the
message. A future "let's make the threshold 75, it's tidier" fails the build
instead of failing silently in production.

### 2. The free tier is switched off in Australia — so the app is dead at the departure gate

**Now fixed.** The write-up below is kept as the reasoning; what shipped is
described in "The destination model" further down.

`homeCountry` is set immutably from the first geo lookup. Install the app at home
in Sydney the week before you fly — which is exactly when a traveller downloads a
travel app, and exactly when you want them to, because they still have Wi-Fi to
install the eSIM profile on — and you are permanently priced against Australian
roaming, where Oceania wholesale is the second most expensive region on earth and
the engine correctly refuses to serve a free tier at all.

So the most valuable acquisition moment in the entire funnel currently produces a
user who opens the app, is told free data is not available in their country, and
uninstalls. The people who *can* earn are the ones who found you after landing
with no connectivity — which is the one moment they cannot download an app.

**The fix is not a config change.** It is asking "where are you heading?" on
first run and pricing against the destination, with the answer editable
afterwards. That screen is built in the preview — first item in the scenario
switcher. It also becomes the natural place to run the eSIM compatibility check
(below), so one screen closes two holes.

---

## Fixed in this pass

| | What it did |
|---|---|
| Day-one threshold | See above. Plus a load-time invariant so it cannot recur. |
| Earn screen had no error state | First launch on airport Wi-Fi behind a captive portal spun forever — no retry, no exit, force-quit was the only way out. The status line was rendered inside a list that never built while the response was null. This is the *modal* first-run condition for a connectivity product. |
| "Region unsupported" was a lie | `regionSupported` and `budgetExhausted` were one boolean. Every time the $5 daily cap tripped, an honesty-branded app told every user in every country that their destination was unsupported. False, and the single fastest way to destroy the differentiator. Two fields now, with distinct copy. |
| Redemption dead-ended | Earning 50 MB produced a sentence and left you to go find the eSIM yourself. Now pushes straight to the install screen. Every tap between the payoff and an installed profile drops users, and the eSIM is worth nothing until it is on the phone. |

---

## The destination model — what shipped

The app now tracks **three** countries instead of one, because the old single
`country` field was answering two different questions with one answer:

| | Sets | Source |
|---|---|---|
| **Home** | the ceiling on ad value | signup market, immutable |
| **Current** | the floor on ad value | CDN geo header |
| **Destination** | the data cost, entirely | the user, changeable any time |

Collapsing *current* and *destination* is what priced a Sydney user planning a
Tokyo trip against Australian roaming — the second most expensive region on
earth, where the engine correctly refuses to run a free tier — and told them
their country was unsupported.

Separating them did more than fix the bug. When *current* equals *home*, the
revenue blend collapses to the full home-market rate with no roaming-retention
discount, and correctly so: an Australian watching an Australian ad on an
Australian IP is not a hypothesis about how much eCPM survives roaming, it is
simply an Australian ad impression. **Earning before you fly is both cheaper for
us and larger for the user, at the same time.**

What that is worth, from the engine, at starter volume, for an Australian:

| Destination | Before you fly | After you land |
|---|---|---|
| Indonesia, Thailand, Vietnam, Singapore | **13 MB** | 6 MB |
| Pakistan | **10 MB** | free tier off |
| United Kingdom, Italy | 9 MB | 9 MB |
| Japan, China | **7 MB** | 6 MB |
| United States | 7 MB | **9 MB** |
| UAE | **5 MB** | free tier off |
| Australia, New Zealand | free tier off | free tier off |

Note the United States: American eCPMs beat Australian ones, so the arbitrage
runs backwards there. The picker shows both numbers and the copy is derived from
which is larger, rather than asserting a rule — being confidently wrong about a
number the user can check is how an honesty-positioned product loses its
position.

Pakistan is the case that proves the model. South Asian ad rates cannot fund a
usable grant in-country, so under the old design it was simply off. Priced
against a departure, it funds 10 MB an ad, and the app says "stock up before you
fly" instead of "unsupported".

**China** routes roaming data back through the profile's home network rather
than breaking out locally, so services unreachable on a local Chinese SIM
generally still work. The picker says exactly that, and says we cannot guarantee
it — routing is the network's decision, not ours, and we are not selling a
circumvention tool.

Also shipped alongside it: the eSIM compatibility check (Android
`EuiccManager.isEnabled` plus the hardware feature flag, both required, with
"unknown" as a first-class answer that warns rather than locks anyone out), and
destination-specific cautions surfaced *before* the choice.

### Australia

Australia is in the picker, priced, and switched off — by **2%**. An Australian
ad view funds 4.9 MB against a 5 MB floor. `breakEvenUsdPerGb()` prints the
exact number: **$2.157/GB needed, $2.20 rack rate**. It flips on at the *growth*
tier, around 500 activations a month — not scale, not enterprise.

That is the whole gap between us and a competitor running a free tier here. It
is a supplier conversation, not a product problem. Take the number to them.

The thing that could actually stop it is not economic: data *consumed in
Australia by Australians* is a materially different regulatory product from
outbound travel roaming, and that difference is where carriage-service-provider
registration and emergency-call obligations live. Worth noting that Firsty
positions its free tier as a travel service for people roaming into a region,
not as domestic service. Assume that framing is deliberate.

---

## Open — before you take a single real user

**Checkout loses the user.** Buying a plan opens the system browser with no
session token, so the purchase lands on a *different* user — a fresh anonymous
identity created by the browser's cookie jar. The customer pays, sees nothing,
and emails you. Guaranteed refund plus support ticket on every single paid
conversion, and it will look like a payments bug when it is a session-handoff
bug. The fix is a short-lived signed token in the checkout URL.

**No consent plumbing for ads.** Your users are, by definition, abroad — often in
the EEA. Serving personalised ads there without a UMP consent flow is an AdMob
policy violation and a GDPR exposure, and AdMob suspends accounts for it rather
than warning.

---

## Open — before the store listing goes public

- **eSIM detail is never cached offline.** The activation code is unreachable
  precisely when someone has landed with no connectivity. That is the one moment
  the app exists for.
- **Micro packets are 7-day validity and this is never disclosed.** Under
  Australian Consumer Law, a material term that only surfaces after purchase is
  a problem, and it is a trust problem before it is a legal one.
- **Captive portals are diagnosed as "server down."** A portal returns 200 with
  an HTML login page; the client tries to parse it as JSON and throws
  `FormatException`. Detect the mismatch and say "you need to sign in to this
  Wi-Fi network" — which is both true and actionable.
- **No `catch` on `_redeem` or `_watchAd`.** A network blip after a 45-second ad
  produces silence. After waiting 45 seconds. That is the worst possible moment
  to say nothing.

---

## Accessibility

Four contrast failures against WCAG AA, all in states people hit when stressed:

| Element | Measured | Needs |
|---|---|---|
| Error detail text | 1.33 : 1 | 4.5 : 1 |
| Busy spinner on the primary button | 2.47 : 1 | 3 : 1 |
| Progress meter track | 1.09 : 1 | 3 : 1 |

All three are corrected in the preview — the CSS marks each `/* FIX */` with the
original value beside it, so the change is auditable rather than silent.

Beyond contrast: there is not one `Semantics` widget in the app, so a screen
reader announces the balance card as an unlabelled pile of text. And text
overflows at roughly 130% scaling, which is a common setting rather than an edge
case — a lot of people travelling are travelling with their parents' eyesight.

---

## The competitive move worth making

The differentiation review's strongest finding, and it is a product decision
rather than a bug: **let people bank megabytes at home before they fly.**

Right now earning only works abroad. That is backwards on three counts at once:

- **Ad value.** An Australian ad impression is worth several times a Vietnamese
  one. You currently earn at the destination's rate and spend at the
  destination's cost. Reverse it and the arbitrage widens.
- **Retention.** A travel app that is only useful during travel gets opened four
  times a year. One that banks value between trips gets opened weekly.
- **Acquisition.** The pre-trip window is when people install travel apps, and it
  is the only window in which they can reliably install an eSIM profile — they
  have Wi-Fi.

It also happens to be the same code change as the destination picker: once
earning is priced against where the data will be *used* rather than where the
phone currently *is*, banking at home falls out for free. One change, three
problems.

---

## Order I would do it in

1. ~~Destination picker + home-market earning~~ — **done**
2. ~~eSIM compatibility check~~ — **done** (Dart + Kotlin; the setup script
   installs `MainActivity.kt`, so re-run it after any `flutter create`)
3. Checkout session handoff — every paid conversion is currently a refund
4. UMP consent — required before real ad inventory
5. Offline caching of the activation code, captive-portal detection, catch blocks
6. `Semantics`, text scaling (contrast fixes are in)
7. Validity disclosure on micro packets

Items 3–4 are pre-launch. 5–7 can ship in the first update, but not much later.

Two supplier/legal items sit outside that list and both gate real money: the
telco advice below, and a rate-card conversation that could switch Australia on.

---

## Still outstanding, unrelated to this review

- **Telco law.** Whether reselling roaming data makes you a registrable carriage
  service provider under the 2025 Australian registration scheme is unresolved,
  and the penalties attached to that scheme are in the ~$10M range. Get an
  advice before you take money, not after.
- `LEGAL_ENTITY.tradingName` is still a TODO in `legal.ts` and feeds both the
  privacy policy and the Play Data Safety answers.
