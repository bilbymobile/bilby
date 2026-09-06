# android-config is now historical

`app/android/` is a real, committed Android host project. There is no
`flutter create` step and nothing in this folder needs copying.

These files were the fragments you used to apply by hand. They are kept only so
the reasoning in their comments is not lost. **Do not copy them anywhere.** The
live versions are:

| Was here | Lives at |
|---|---|
| `MainActivity.kt` | `android/app/src/main/kotlin/com/bilbymobile/bilby/MainActivity.kt` |
| `network_security_config.xml` | `android/app/src/main/res/xml/` |
| `AndroidManifest-additions.xml` | merged into `android/app/src/main/AndroidManifest.xml` |
| `proguard-rules.pro` | `android/app/proguard-rules.pro` |
| `build-gradle-notes.md` | `android/app/build.gradle.kts` |
| `build.gradle.kts` | `android/app/build.gradle.kts` |

Two things in here are **wrong** and were corrected on the way in:

- `build-gradle-notes.md` and `build.gradle.kts` say the applicationId is
  `com.bilbymobile.app`. It is **`com.bilbymobile.bilby`**. The mismatch is what
  caused a silent App Links verification failure: `assetlinks.json` names the
  real package, so a build with the wrong one opens every deep link in the
  browser with no error anywhere.
- `AndroidManifest-additions.xml` requires the AdMob `APPLICATION_ID` meta-data.
  The free tier is dropped and `google_mobile_ads` is gone from `pubspec.yaml`,
  so that entry is not merely unnecessary, it would be declaring a dependency
  the app no longer has.
