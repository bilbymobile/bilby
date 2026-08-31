# Bilby launch playbook

Written for your actual situation: **organisation Play account with a D-U-N-S
number**, **sole trader with an ABN**, **no supplier yet**.

The organisation account matters more than you might think. Personal developer
accounts opened after November 2023 must run a closed test with 12 testers for
14 continuous days before Google will even consider a production application.
You are exempt. That removes about three weeks from this plan and it is the
single biggest structural advantage you have right now.

Read Phase 0 today. It contains a deadline.

---

## Phase 0. Two things that are time critical

### 0.1 Target API 36, and the date is 31 August 2026

From **31 August 2026** every new app and every update must target **API 36**.
That is sixteen days from now. Miss it and Play Console will not accept the
bundle at all. It is a rejection at upload, not a warning at review.

`setup-windows.ps1` already forces this, so most likely you are covered. Verify
rather than assume:

```powershell
cd C:\Nav\Nextwave\Products\n eSim\app
Select-String -Path android\app\build.gradle* -Pattern "targetSdk|compileSdk|minSdk"
```

You want `compileSdk 36`, `targetSdk 36`, `minSdk 23`. If you regenerated
`android/` at any point with `flutter create`, those values reverted to the
Flutter template and you need to run the setup script again. `build-release.ps1`
also refuses to build if targetSdk is below 36, so this cannot silently slip
past you.

`minSdk 23` is deliberate. eSIM itself needs Android 9, but the app must still
install on older handsets so it can tell those users honestly that their phone
cannot take a profile. Refusing to install is a one star review; explaining is
not.

### 0.2 The telco question is the only thing that can actually stop you

Reselling roaming data in Australia sits near the carriage service provider
registration scheme, and the penalties attached to that scheme run into the
millions. Nobody in this document can resolve that for you.

**Get a one hour paid consult with an Australian telecommunications lawyer
before you take a single dollar.** Not before you launch the free tier, but
before money moves. Budget four hundred to eight hundred dollars. Ask three
questions:

1. Does reselling roaming data to outbound Australian travellers make me a
   registrable carriage service provider?
2. Does the answer change if I later sell data consumed inside Australia?
3. What are my emergency call obligations, given the product is data only?

Question two is the one that decides whether the Australia free tier is ever
switchable. Note that Firsty positions its free tier as a travel service for
people roaming into a region rather than as domestic service, and assume that
framing is deliberate.

---

## Phase 1. Supplier, and how to start with almost no downside

You asked which supplier is easy to start with, low loss and profitable. Here is
the honest comparison, filtered to platforms that need no upfront capital.

| Platform | Setup | Monthly | Minimum | Go live | API |
|---|---|---|---|---|---|
| **Airalo Partners** | free | none | none | fast | yes |
| **Celitech** | zero | zero | none | days | yes |
| **eSIM Go** | free | per download | none | 48 hours | yes |
| MobiMatter | free | none | **$250 order** | days | yes |
| Omax | €500 + €500 deposit | none | | 48 hours | yes |
| BNESIM | **€40,000** | €1,500 | | weeks | yes |

Ignore everything below the line. Paying forty thousand euros to enter a market
you have not validated is how this business fails before it starts.

### The recommendation

**Open accounts with Airalo Partners and eSIM Go on the same day. Both are
free.** Integrate whichever answers the questions below better, and keep the
other as your second quote. Having two live accounts costs you nothing and it is
the only leverage you will ever have on rate cards.

Airalo has the largest catalogue and the most credibility, which matters when
your app promises coverage in 190 countries. eSIM Go tends to be more flexible
on packet sizes and is more used to API first partners. Celitech is worth a look
as a third if either of the first two is slow to respond, but note the platform
takes a backend margin on every data transaction, which means you do not fully
control your own economics.

### The four questions that decide everything

Send these before you sign anything. The first two are not negotiable for this
product and most sales people will not volunteer the answers.

**1. What is your smallest purchasable packet?**

This is the question that can kill the free tier. Your redemption threshold is
50 MB. If the smallest thing a supplier will sell is 1 GB, you are buying twenty
times more data than you are giving away and the economics in `pricing.ts`
collapse immediately. Ask for the smallest SKU by region, in writing.

**2. Can I top up an existing ICCID through the API?**

The whole design is one eSIM per user, topped up forever. If every redemption
issues a new profile, users accumulate nine profiles in their phone settings and
uninstall. Confirm there is a top up endpoint, not just an issue endpoint.

**3. What is your rate for Oceania, and what volume unlocks it?**

You already know the number you need: **$2.157 per GB is where the Australian
free tier switches on**, against a $2.20 rack rate. Ask for that specific
figure. "Can you do better on Oceania" invites a shrug. "We need to land under
$2.157 per GB to switch on a free tier, we are quoted $2.20, what volume gets us
there" gets a yes or a no.

**4. What is the refund and failed activation policy?**

Activation failures are the dominant support cost in this category. Find out who
eats the cost when a profile fails to install.

### Expect these economics

Wholesale runs roughly $0.50 to $2 per GB by region. Retail in this market runs
$2 to $8 per GB. Gross margins of 50 to 75 percent, net 30 to 45 percent after
payment fees, refunds and support. Your `pricing.ts` already models the
pessimistic end of every published range, which is the correct way round.

---

## Phase 2. Deploy the web app first, and why the order matters

The website goes live before the Play submission, not after. Three reasons, and
each one is a rejection if you get it wrong.

* Play reviewers **click your privacy policy link**. A 404 is an instant
  rejection and costs you a full review cycle.
* `app-ads.txt` must sit on the **apex domain** and match the developer website
  on your listing exactly, and AdMob takes about 24 hours to crawl it. Start
  that clock early.
* The checkout page lives on the web, so the app cannot be finished without it.

### 2.1 Deploy to Vercel

Free tier, and it stays free until you have real traffic.

```powershell
cd C:\Nav\Nextwave\Products\n eSim\web
npm i -g vercel
vercel login
vercel --prod
```

Then in the Vercel dashboard, add the domain `bilbymobile.com` and the `www`
subdomain, and point your registrar at the nameservers Vercel gives you. DNS
takes anywhere from ten minutes to a few hours.

### 2.2 Environment variables

Set these in Vercel under Settings, Environment Variables, Production. The
defaults in code are safe but deliberately conservative, and two of them are
load bearing.

| Variable | Value at launch | Why |
|---|---|---|
| `SESSION_SECRET` | 32 random bytes | The cookie is the user's balance. Forge it and you forge money. |
| `DAILY_BUDGET_USD` | `5` | Your blast radius, not a growth target. A number you could lose today without it mattering. |
| `DAILY_AD_CAP` | `10` | Bounds one user's take. |
| `REDEMPTION_THRESHOLD_MB` | `50` | Must stay reachable in one day. The invariant throws at boot if it is not. |
| `SUPPLIER_VOLUME_TIER` | `starter` | Raise it the day a rate card says you can. |
| `HOME_MARKET_RETENTION` | `0.4` | A hypothesis until AdMob reporting tells you otherwise. Measure it in week one. |
| `DATABASE_PATH` | see below | |

Generate the secret properly:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2.3 The database will not survive on Vercel, and that is a real problem

SQLite on Vercel writes to an ephemeral filesystem. Every deploy and every cold
start wipes it. Your users' balances disappear, and since there is no email on
file, they are gone permanently.

Two acceptable answers:

* **Turso.** SQLite compatible, generous free tier, and it is a near drop in for
  `better-sqlite3` through `@libsql/client`. This is the small change.
* **Neon or Supabase Postgres.** Free tier, and the migration is real work but
  not a rewrite, because the schema is deliberately plain.

Do not launch without one of these. A lost balance is not a support ticket, it is
an account you cannot recover.

### 2.4 Verify before moving on

Every one of these must return 200 with real content:

```
https://bilbymobile.com/privacy
https://bilbymobile.com/terms
https://bilbymobile.com/refunds
https://bilbymobile.com/app-ads.txt
https://bilbymobile.com/api/me
```

And send `hello@bilbymobile.com` a test email. A reviewer may write to it.

---

## Phase 3. Build the release bundle

### 3.0 One script does all of Phase 3

`app/build-release.ps1` creates the keystore, wires the signing config,
gitignores the secrets, refuses to build if targetSdk is wrong or the legal
pages 404, runs the analyzer and tests, and produces the bundle.

```powershell
cd C:\Nav\Nextwave\Products\n eSim\app
.\build-release.ps1
```

Later, once AdMob has issued a live unit:

```powershell
.\build-release.ps1 -AdUnit "ca-app-pub-XXXXXXXXXXXX/YYYYYYYY"
```

The rest of this phase explains what it is doing and why, so you can do it by
hand if you prefer.

### 3.1 Create the keystore, and back it up like it is irreplaceable, because it is

```powershell
keytool -genkeypair -v -keystore C:\Nav\keys\bilby-release.jks `
  -keyalg RSA -keysize 4096 -validity 10000 -alias bilby
```

Ten thousand days of validity is not arbitrary. Play rejects a bundle signed
with a key that expires before 2033.

Then put a copy in at least two places you will still control in five years. A
password manager and a physical drive. Not just your laptop.

**Lose this file and you can never update the app again.** Not "it is difficult".
You publish a new listing, at a new package name, with zero installs and zero
reviews, and start over. Google's key recovery process exists but it is slow and
it is not guaranteed.

The same permanence applies to `applicationId`. `com.bilbymobile.bilby` is
immutable once published.

### 3.2 Wire the signing config

`android/key.properties`, and add it to `.gitignore` immediately:

```properties
storeFile=C:/Nav/keys/bilby-release.jks
storePassword=...
keyAlias=bilby
keyPassword=...
```

### 3.3 Build

```powershell
cd C:\Nav\Nextwave\Products\n eSim\app
flutter clean
flutter build appbundle `
  --dart-define=API_BASE=https://bilbymobile.com `
  --dart-define=ADMOB_REWARDED_ID=ca-app-pub-3940256099942544/5224354917
```

That AdMob unit is Google's **test** unit, and it is correct for this first
build. You cannot get a real one yet, because AdMob will not create a live unit
for an app that is not published. The real one goes in as an update in Phase 5.

Do not ship a debug build against production ad inventory at any point. That is
how AdMob accounts get suspended for invalid traffic, and suspension is very hard
to reverse.

Output lands at `build/app/outputs/bundle/release/app-release.aab`.

---

## Phase 4. Play Console

Everything below comes from `PLAY-SUBMISSION.md`, which is generated from
`web/src/lib/legal.ts`. Regenerate it if you change any legal text:

```powershell
cd web ; npx tsx scripts/gen-play-kit.ts
```

The point of generating it is that your Data Safety answers and your published
privacy policy cannot drift apart. A mismatch between them is treated as
misrepresentation rather than as a paperwork error, and it is the most common
privacy related removal from Google Play.

### 4.1 Create the app

App name `Bilby`, category **Travel and Local**, free, contains ads **yes**.

Not declaring ads is a removable offence and you have rewarded video. Tick it.

### 4.2 The order to fill things in

Play Console lets you do these in any order and then blocks the release on
whichever you forgot. Do them in this order and nothing blocks:

1. **App content**: privacy policy URL, ads declaration, content rating
   questionnaire, target audience (adults only, so you avoid the families
   policy entirely), data safety, government apps, financial features (none),
   health (none)
2. **Store listing**: title, short description, full description, graphics
3. **Store settings**: category, contact details, external marketing
4. **Production release**: upload the bundle, release notes, roll out

### 4.3 Graphics you need before you start

| Asset | Size | Note |
|---|---|---|
| App icon | 512 x 512 PNG | `brand/make-icons.py` produces it |
| Feature graphic | 1024 x 500 | Shown at the top of your listing |
| Phone screenshots | at least 2, up to 8 | Use the v3 preview, dark |
| Tablet screenshots | optional | Skip for now |

Lead with the screenshot that shows the balance and the destination card. It is
the only frame that explains the product without words.

### 4.4 Data safety, in one line each

Collected: account identifier, approximate location as country only, device
advertising identifier, eSIM identifier, earning history. Shared: the advertising
identifier, with Google AdMob. Encrypted in transit: yes. Deletion available: yes,
by email.

Do **not** tick Analytics or Personalisation. You do not have those tools yet.
Over declaring is not the safe option, because it has to match the policy, and
the policy describes what the code actually does.

### 4.5 What reviewers reject this category for

Worth reading once, because each costs a review cycle:

* **Minimum functionality.** Apps that look like a website in a wrapper get
  rejected. Yours clears the bar with native rewarded video and the system eSIM
  handoff, but say so in the listing rather than describing it as a web app.
* **A privacy policy that 404s or does not mention ads.** Both are instant.
* **Undeclared ads.**
* **Data Safety disagreeing with the privacy policy.**
* **Health or emergency claims.** Never imply the eSIM can be relied on for
  emergency calls. It is data only and the terms say so.

Expect the first review to take one to seven days.

---

## Phase 5. AdMob, and why it comes last

**AdMob will not serve ads on an unpublished app.** This one fact drives the
entire sequence in this document. Until the listing is live, every ad request
returns no fill, the free tier grants nothing, and the product does not work.

That is why you submit before payments exist, and why the first build ships with
a test ad unit.

Once the app is live:

1. Create the AdMob app and **link it to the Play listing**. Linking is what
   proves ownership and it is what unlocks real inventory.
2. Create a **rewarded** ad unit. Not interstitial, not banner.
3. Set the server side verification callback to
   `https://bilbymobile.com/api/ads/ssv`
4. Publish `app-ads.txt` on the apex domain and allow 24 hours for the crawl.
5. Rebuild with the real unit id and ship it as an update.

```powershell
flutter build appbundle `
  --dart-define=API_BASE=https://bilbymobile.com `
  --dart-define=ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/YYYYYYYY
```

### Week one measurement, and it is the most valuable thing you will do

`HOME_MARKET_RETENTION` is set to 0.4. That number is a hypothesis: it says 40
percent of the Australian eCPM premium survives being served to a device sitting
on a foreign network. The entire traveller arbitrage rests on it.

In AdMob reporting, segment by device country against app store country, and
compare realised eCPM for Australian account users abroad against local users.
Then set the variable to what you measured, not what you hoped.

If it turns out near zero, the engine degrades gracefully to destination only
pricing and you have lost nothing. If it is 0.5 or better, the free tier works
across all of Southeast Asia and this is a different business.

---

## Phase 6. Payments, after the app is live

Stripe, sole trader with your ABN. Checkout stays on the web and opens in an
external browser, never a webview.

That is not a technical preference. Google Play's payments policy exempts
purchases consumed outside a Play distributed app, and mobile connectivity is
consumed by the handset's modem rather than inside the app. It is an
interpretation rather than a written eSIM carve out, so the structure has to be
conservative: no app feature is ever gated behind a purchase, because the moment
one is, a data plan becomes an in app digital good and the argument collapses.

Fifteen percent of a 45 percent margin is a third of your profit. Worth getting
right the first time.

**Before you take a single payment, fix the checkout session handoff.** Today the
checkout URL carries no session token, so the purchase lands on a different
anonymous user than the one who started it. Every paid conversion becomes a
refund and a support ticket, and it will look like a payments bug when it is a
session bug.

---

## Phase 7. The first four weeks after launch

Watch three numbers and ignore everything else.

**Day one activation.** Of people who install, how many earn at least one
reward? If this is under 30 percent the first run flow is broken, not the
economics.

**Redemption rate.** Of people who earn, how many reach 50 MB and load it onto an
eSIM? Expect 40 to 60 percent of accrued credits never to be redeemed. That
breakage is not a bug. At starter volume it is most of your free tier margin.

**Realised contribution.** `/api/economics` computes this from the ledger rather
than from projections. If it is negative, the free tier is switched on somewhere
it should not be, and `assertThresholdReachable` plus the region guards should
have caught it.

Then build, in this order and no other:

1. **Arrival Autopilot.** The positioning made real, and mostly one screen fired
   by an event you already detect.
2. **Document watchdog, packing checklist, currency tracker.** Three weekends,
   and they turn a single purpose utility into an app with reasons to exist.
3. **Follow a friend's trip.** The retention and growth engine. Nothing else
   comes close.
4. **Support deflection automation.** Build it before you need it, because it
   decides whether one person can run this at scale.

The reasoning for that order is in `STRATEGY.md`. The short version: Hopper had
$850M of revenue and still lost ten million users in a year, because they
monetised the moment and never solved the habit. Do not repeat that sequence.

---

## The critical path, on one line each

| # | Step | Blocks | Cost |
|---|---|---|---|
| 1 | Verify target API 36 | the upload itself | free, 5 minutes |
| 2 | Telco legal consult | taking money | $400 to $800 |
| 3 | Supplier accounts, Airalo and eSIM Go | real provisioning | free |
| 4 | Move off ephemeral SQLite | not losing balances | free tier |
| 5 | Deploy web, legal pages live | the Play review | free |
| 6 | Keystore, backed up twice | every future update | free |
| 7 | Build with the test ad unit | submission | free |
| 8 | Play submission, production | all revenue | $25 once, already paid |
| 9 | AdMob app, linked, rewarded unit, SSV | the free tier working | free |
| 10 | `app-ads.txt` crawl | ad revenue | free, 24 hours |
| 11 | Rebuild with the real unit | ads actually serving | free |
| 12 | Stripe and the checkout session fix | paid conversions | 1.75% + 30c |

Everything on that list except the lawyer is free. The lawyer is the one line
item worth paying for before revenue, because it is the only one that can end
the business rather than delay it.
