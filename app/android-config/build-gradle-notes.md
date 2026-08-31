# `android/app/build.gradle.kts` (or `.gradle`)

Google Play requires **new apps and updates to target Android 16 (API 36) from
31 August 2026**. Flutter's template will generate a lower value — change it.

```kotlin
android {
    namespace = "com.bilbymobile.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bilbymobile.app"   // IMMUTABLE once on Play
        minSdk = 23        // eSIM needs 22+; 23 is a safer floor for the ads SDK
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
}
```

**`applicationId` cannot be changed after your first Play release.** Changing it
later means a new listing with zero installs and zero reviews. Confirm the
trade mark position before you publish, not after.
