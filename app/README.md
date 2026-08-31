# Bilby — Flutter app

Android-first client. The Next.js project is **backend + web storefront**; this
is the revenue surface, because rewarded ads only exist in an app.

---

## ⚠️ Read this before you start

**This code has never been compiled.** No Flutter SDK in the environment it was
written in, and pub.dev was unreachable. Every likely error I could find by
review has been fixed — see *Fixed by review* below — but assume there are
more. Budget an hour of `flutter analyze` cleanup, not a day.

**The backend, by contrast, is tested.** 16 assertions passing, and every
endpoint this app calls was smoke-tested end to end: `/api/me`, `/api/redeem`,
`/api/esim/{iccid}`, `/api/catalog`, `/checkout`. If something breaks, suspect
the Dart first.

---

## Run it in 6 steps

### 1. Start the backend

```bash
cd web
npm install
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → SESSION_SECRET
npm run dev            # http://localhost:3000
```

Leave it running. Supplier defaults to `mock`, so no credentials and no money.

### 2. Generate the Android host project

```bash
cd app
flutter create . --org com.bilbymobile --platforms=android
flutter pub get
```

`flutter create .` over the existing directory generates `android/` without
touching `lib/`.

### 3. Apply the Android config

From `app/android-config/`, which exists precisely so you do not have to
discover these the hard way:

| Copy | To |
|---|---|
| `network_security_config.xml` | `android/app/src/main/res/xml/` |
| Contents of `AndroidManifest-additions.xml` | merge into `android/app/src/main/AndroidManifest.xml` |
| `build-gradle-notes.md` | apply to `android/app/build.gradle.kts` |

**Do not skip the network security config.** Android blocks cleartext HTTP from
API 28 on, so without it every call to your dev server fails with a
`SocketException` that reads exactly like "the backend is down."

### 4. Copy the launcher icons

```bash
cp -r ../brand/assets/android/mipmap-* android/app/src/main/res/
```

### 5. Run

```bash
flutter run \
  --dart-define=API_BASE=http://10.0.2.2:3000 \
  --dart-define=ADMOB_REWARDED_ID=ca-app-pub-3940256099942544/5224354917
```

`10.0.2.2` is the host machine as seen from an Android emulator. On a **physical
device**, use your machine's LAN IP (`http://192.168.x.x:3000`) and add that IP
to `network_security_config.xml`.

The ad unit above is Google's official rewarded test unit. Keep it in debug.

### 6. Verify the loop

Tap **Watch ad → earn**. You should see a test ad, then the balance count up
with a haptic and a particle burst.

> **In debug the credit comes from `/api/dev/simulate-ad`, not from AdMob.**
> Real SSV needs a publicly reachable callback URL, which localhost is not. To
> test the genuine path, deploy the backend, set the SSV callback in the AdMob
> console to `https://yourdomain/api/ads/ssv`, and point `API_BASE` at it.

---

## What's in the app

```
lib/
  brand.dart                 name, colours, and the Motion system
  api/
    client.dart              HTTP + the session cookie that IS the account
    models.dart              wire models
  services/
    ads_service.dart         AdMob rewarded + SSV. Grants nothing itself.
    esim_service.dart        universal-link handoff to the system installer
  screens/
    earn_screen.dart         the product
    plans_screen.dart        retail catalogue, checkout opens externally
    esims_screen.dart        your profiles
    install_screen.dart      one-tap install, manual fallback
  widgets/
    common.dart              cards, buttons, notes, error state
    animated_balance.dart    the counter
    reward_burst.dart        the payoff
```

### The one thing not to break

`ads_service.dart` **never grants data**. `onUserEarnedReward` is a client-side
event on a device you do not control — treating it as proof turns the free tier
into an open faucet on your supplier wallet.

The real path: this app attaches the user's *signed* id via
`ServerSideVerificationOptions` → Google's servers call `/api/ads/ssv` → the
backend verifies an ECDSA signature, dedupes the transaction id, checks caps and
budget → *then* the ledger moves → this app polls until the balance changes.

That poll is not decoration. The callback lands after the ad closes, so without
it the user sees a finished ad and a static balance and concludes you cheated
them.

### Motion

Every duration and curve lives in `Motion` in `brand.dart`. Nothing linear;
entrances decelerate and exits accelerate; nothing over 400ms on a primary
interaction; haptics fire *before* visuals, because touch registers faster than
sight.

---

## Why Flutter over Kotlin + Compose

Both are excellent now. Flutter wins for this app specifically because it
renders every pixel itself via Impeller (Vulkan on Android), giving full control
over custom motion — and **your differentiator is a reward moment**. The
half-second where data lands is the entire retention mechanic. Add that one
codebase covers iOS later, and it is the call.

Compose would win if Android were the only plan for two years: smaller binary,
easier path to 120fps, bigger hiring pool.

**Caveat:** Impeller still has rough edges with PlatformViews, and some
mid-range Adreno GPUs need fallbacks. Test on a real cheap Android phone, not
just an emulator — that is most of your emerging-market install base.

---

## Fixed by review (before you find them)

| Bug | Symptom it would have caused |
|---|---|
| `SpringDescription` used with only `material.dart` imported | Compile error — it lives in `flutter/physics.dart` |
| `pubspec.yaml` declared `assets/`, which does not exist | Hard build failure, not a warning |
| Dart client matched cookie name `nesim_uid`, server now sends `bilby_uid` | **Every launch is a new user with zero balance** — reads as a ledger bug, is a cookie bug. Now matches on the `_uid=` suffix |
| `FontFeature` used without `dart:ui` import | Compile error on some Flutter versions; `painting.dart`'s re-export list has varied |

## Errors to expect anyway

| Error | Fix |
|---|---|
| `withValues isn't defined for Color` | Flutter < 3.27. Upgrade, or replace with `withOpacity()` |
| `The method 'setServerSideOptions' isn't defined` | `google_mobile_ads` major version drift — check the API for your version |
| `RewardedAdLoadCallback` signature mismatch | Same cause; the load callbacks move between majors |
| Records syntax `({String smdp, ...})` rejected | Dart < 3.0. `pubspec.yaml` requires `>=3.5.0` |
| `Connection refused` / cleartext error | Step 3. It is always step 3 |

Run `flutter analyze` first — it surfaces all of these at once rather than one
rebuild at a time.

---

## Not built yet

- **Stripe checkout.** `/checkout` renders and explains itself honestly, but
  takes no money. This is the actual blocker for revenue and for Play
  submission.
- **Privacy policy and terms.** Required before you can submit to Play.
- **Account recovery.** The session cookie is currently the only identity —
  lose it and the balance goes with it. Fix this before anyone accumulates a
  balance worth caring about.
- **Offline cache.** The error state is honest, but the app still needs a
  connection to show anything, which is an awkward look for a connectivity
  product.
