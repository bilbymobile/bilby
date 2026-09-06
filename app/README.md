# Bilby — Flutter app

Android first client for the travel eSIM. The Next.js project is the backend and
the web storefront; this is the handset surface.

---

## Run it

Two commands, once the backend is up. There is **no `flutter create` step**:
`android/` is committed, so a clone builds.

```bash
# 1. backend, in another terminal
cd web && npm run dev              # http://localhost:3000, supplier defaults to mock

# 2. the app
cd app
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:3000 \
            --dart-define=APP_BASE=http://10.0.2.2:3000
```

`10.0.2.2` is how the **Android emulator** reaches the host machine. On a
**physical handset** use your machine's LAN address instead, on the same wifi:

```bash
flutter run --dart-define=API_BASE=http://192.168.1.42:3000 \
            --dart-define=APP_BASE=http://192.168.1.42:3000
```

...and add that address to `android/app/src/main/res/xml/network_security_config.xml`,
which permits cleartext for the emulator loopback and localhost only. Without
it the request fails with a `SocketException` that reads exactly like "the
backend is down" and is not.

Omit both defines and the app talks to `https://api.bilbymobile.com`, which is
what a release build does.

## What you will see

Two tabs and a first run gate.

1. **Where are you going** — first run only, and reachable afterwards from the
   compass in the top corner. Also runs the eSIM capability check.
2. **Plans** — the catalogue for the chosen destination. Buying opens the
   browser, deliberately: see the class doc in `lib/screens/plans_screen.dart`
   for why that is a Play Billing decision and not a convenience.
3. **My eSIMs** — issued profiles, and the install screen that hands the
   activation string to the system eSIM installer.

Against the mock supplier the plans are fabricated and no money moves.

## If the build complains

| Message | Fix |
|---|---|
| `Failed to find target with hash string android-36` | Install **Android 16 (API 36)** in Android Studio, Settings, Languages and Frameworks, Android SDK. Or drop `compileSdk` and `targetSdk` to 35 in `android/app/build.gradle.kts` as a temporary measure. |
| `flutter.sdk not set in local.properties` | Run any `flutter` command in `app/` once; the tool writes the file. |
| Gradle cannot download | First build needs network for the Gradle distribution and the Android artifacts. |

## Build a release APK for a real handset

```bash
flutter build apk --release
```

Signs with the debug key when `android/key.properties` is absent, which is fine
for a trial and **cannot be uploaded to Play** — the correct failure, since an
artifact signed with a debug key can never be updated.

`-Pbilby.shrink=false` turns R8 off to bisect a shrinker induced crash. It is a
diagnostic tool, not a shipping option: such a build gets a `-noshrink` version
suffix so it identifies itself rather than relying on anyone remembering.

## State of the code

The Dart has still **never been compiled** — no Flutter SDK in the environment
it was written in, and pub.dev is unreachable from there. Every error findable
by review and by static sweep has been fixed, but budget an hour of
`flutter analyze` cleanup rather than assuming zero.

The free tier is gone: the earn screen, the ads service, the reward widgets and
`google_mobile_ads` were all removed. That last one matters beyond tidiness —
the SDK crashes at startup unless the manifest declares an AdMob application id,
so keeping a dead dependency would have kept a manifest requirement alive for a
feature that no longer exists.

`android-config/` is historical. See the README inside it.
