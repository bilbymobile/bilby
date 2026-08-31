# Compiling Bilby in Android Studio (Windows)

---

## The one thing that trips everyone up

**Open `app\` in Android Studio. Not `app\android\`.**

Android Studio will happily open `app\android\` as a plain Android project. It
looks right, it syncs Gradle, and then nothing works — because `lib\` is
invisible to it and the Flutter toolchain never runs. If your Project pane shows
`app`, `gradle`, `settings.gradle` at the top level, you opened the wrong folder.

You want to see `lib`, `pubspec.yaml`, `android`, `.run`.

---

## Before you start: two installs

Flutter is **not** part of Android Studio. You need both.

### 1. Flutter SDK

Canonical page: **<https://docs.flutter.dev/install>**

Note the install docs were reorganised — older guides (including an earlier
version of this one) point at `docs.flutter.dev/get-started/install/...`, which
is the old structure. `/install` is the current path.

Download the SDK zip, extract somewhere with **no spaces and no special
characters** in the path — `C:\dev\flutter` is fine, `C:\Program Files\` is not
— and add `C:\dev\flutter\bin` to your PATH.

```powershell
Expand-Archive -Path $env:USERPROFILE\Downloads\flutter_windows_<version>-stable.zip `
               -Destination C:\dev\
```

Reopen PowerShell, then:

```powershell
flutter --version
```

#### If docs.flutter.dev won't load for you

The domain is live, so a failure is almost certainly local — a corporate proxy,
DNS, or an ad/tracker blocker. Two ways around it:

**Direct from GitHub.** The Flutter repo *is* the SDK; this has always worked
and still does, though the docs no longer feature it:

```powershell
cd C:\dev
git clone https://github.com/flutter/flutter.git -b stable
# then add C:\dev\flutter\bin to PATH
flutter --version    # first run bootstraps the Dart SDK, takes a few minutes
```

**Via a package manager**, if you already use one:

```powershell
winget install --id Google.Flutter      # or:  choco install flutter
```

If none of those work either, the block is upstream of you and worth mentioning
to whoever runs the network — `github.com` and `storage.googleapis.com` both
need to be reachable, since that is where the SDK and all pub packages come
from. Nothing in this project will build without them.

### 2. Android Studio components

**Settings → Plugins** — install **Flutter** (it pulls in Dart automatically),
then restart.

**Settings → Languages & Frameworks → Android SDK → SDK Platforms** — tick
**Android SDK Platform 36**. This one is easy to miss: the project targets API
36 because Play requires it for new apps from **31 August 2026**, and without
the platform installed the build fails with:

```
Failed to find target with hash string 'android-36'
```

**SDK Tools** tab — tick **Android SDK Command-line Tools**. `flutter doctor`
fails without it and the message is not obvious.

Then:

```powershell
flutter doctor
flutter doctor --android-licenses    # accept all
```

Every line should be `[√]`. A `[!]` on "Android toolchain" is almost always the
command-line tools or unaccepted licences.

---

## Setup: run one script

The zip does **not** contain an `android\` folder — it is generated, and
shipping a generated folder is how you get version conflicts. The script builds
it and applies the four patches that are easy to get wrong by hand.

```powershell
cd "C:\Nav\Nextwave\Products\n eSim\bilby-app\app"
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

It will:

1. Run `flutter create .` to generate `android\`
2. Install the network security config
3. Patch `AndroidManifest.xml` — INTERNET and AD_ID permissions, AdMob app id
4. Force `compileSdk`/`targetSdk` to 36
5. Copy the launcher icons and run `flutter pub get`
6. Run `flutter analyze` so you see every Dart error at once

Safe to re-run — every step checks before it writes.

**Step 2 is not optional.** Android blocks cleartext HTTP from API 28 on. Skip
it and every call to your dev server fails with a `SocketException` that reads
exactly like "the backend is down", and you will spend an hour on the wrong
problem.

---

## Then: three steps to a running app

### 1. Start the backend

In a **separate terminal**, and leave it running:

```powershell
cd "C:\Nav\Nextwave\Products\n eSim\bilby-app\web"
npm install
copy .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that value into `SESSION_SECRET` in `.env.local`, then:

```powershell
npm run dev
```

Confirm <http://localhost:3000> loads. Supplier defaults to `mock`, so no
credentials and no money.

### 2. Open the project

**File → Open →** `C:\Nav\Nextwave\Products\n eSim\bilby-app\app`

Wait for "Pub get" and the Gradle sync to finish. First sync downloads a lot —
give it a few minutes.

### 3. Pick the run configuration and press Run

In the dropdown at the top, choose **`bilby (dev)`**.

That configuration ships in `.run\` and Android Studio picks it up
automatically. **Do not just press the green Run button on the default
configuration** — this app reads its backend URL from a compile-time
`--dart-define`, so without those args it builds against
`https://bilbymobile.com`, a domain that does not exist yet, and every screen
shows the offline error.

If the dropdown is empty, add it by hand: **Run → Edit Configurations → + →
Flutter**, dart entrypoint `lib\main.dart`, and in **Additional run args**:

```
--dart-define=API_BASE=http://10.0.2.2:3000 --dart-define=ADMOB_REWARDED_ID=ca-app-pub-3940256099942544/5224354917
```

Start an emulator (**Device Manager → play**), pick it in the device dropdown,
press **Run**.

---

## What you should see

The Earn screen, a balance of 0 MB, and a grant rate that depends on where the
server thinks you are.

Tap **Watch ad · earn** → the balance counts up with a haptic and a particle
burst.

> **In debug, the credit comes from `/api/dev/simulate-ad`, not AdMob.** Real
> server-side verification needs a publicly reachable callback URL, which
> localhost is not. You will see a real Google test ad, but the SSV path only
> exercises once the backend is deployed and the callback is set in the AdMob
> console.

---

## Physical device instead of emulator

`10.0.2.2` only means "host machine" inside an emulator. On a real phone:

1. Find your PC's LAN IP — `ipconfig`, look for IPv4 (e.g. `192.168.1.42`)
2. Change `API_BASE` in the run configuration to `http://192.168.1.42:3000`
3. Add that IP to `android\app\src\main\res\xml\network_security_config.xml`
4. Phone and PC on the same Wi-Fi; allow Node through Windows Firewall

Worth doing early. A physical mid-range Android is the only honest test of
whether the reward animation feels good, and it is most of your install base.

---

## When it goes wrong

| Symptom | Cause |
|---|---|
| `Failed to find target with hash string 'android-36'` | SDK Platform 36 not installed. SDK Manager |
| `cmdline-tools component is missing` | SDK Tools → Android SDK Command-line Tools |
| Project pane shows `app`/`gradle`, no `lib` | You opened `app\android\`. Close, reopen `app\` |
| Every screen shows the offline error | Run configuration is missing `--dart-define`, or the backend is not running |
| `SocketException: Cleartext HTTP traffic not permitted` | Network security config missing — re-run the setup script |
| `withValues isn't defined for Color` | Flutter older than 3.27. `flutter upgrade` |
| `setServerSideOptions isn't defined` | `google_mobile_ads` version drift; check the API for your version |
| Balance resets to 0 on every launch | Cookie not persisting — check the backend is sending `Set-Cookie` and `SESSION_SECRET` is stable |
| Gradle sync hangs forever | Usually a proxy or corporate firewall. `flutter doctor -v` shows more |

Run `flutter analyze` before debugging anything visually — it surfaces every
Dart error at once instead of one rebuild at a time.

---

## Building a release AAB

Not yet — you have no privacy policy, no terms and no Stripe, so you cannot
submit to Play regardless. When you get there:

```powershell
flutter build appbundle `
  --dart-define=API_BASE=https://bilbymobile.com `
  --dart-define=ADMOB_REWARDED_ID=<your real rewarded unit>
```

Two things to get right before that first build:

- **Keystore.** Generate it, back it up somewhere you will still have in five
  years. Lose it and you can never update the app.
- **`applicationId`.** `com.bilbymobile.app` is immutable once published.
  Changing it later means a new listing with zero installs and zero reviews.

Sources: [Flutter Windows setup](https://docs.flutter.dev/install) ·
[Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
