import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // Must come last: it reads values the two plugins above define.
    id("dev.flutter.flutter-gradle-plugin")
}

/*
 * Release signing.
 *
 * A keystore is never committed. `key.properties` is gitignored; if it is
 * absent the release build falls back to the debug key so that
 * `flutter build apk --release` still works for a trial on a real handset.
 *
 * A debug signed release CANNOT be uploaded to Play, which is the correct
 * failure: it stops at the upload rather than shipping an artifact nobody can
 * ever update.
 */
val keyProps = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasKeystore = keyProps.getProperty("storeFile") != null

/*
 * R8 shrinking, switchable from the command line.
 *
 * `-Pbilby.shrink=false` exists to bisect a shrinker induced crash, which this
 * app has already had once. It is a diagnostic tool, not a shipping option: the
 * suffix below makes an unshrunk build identify itself, because "we will
 * remember to turn it back on" is not a process.
 */
val shrink = (project.findProperty("bilby.shrink") as String?)?.toBoolean() ?: true

android {
    namespace = "com.bilbymobile.bilby"

    /*
     * If Gradle cannot find this platform, install "Android 16 (API 36)" in
     * Android Studio under Settings, Languages and Frameworks, Android SDK.
     * Dropping both this and targetSdk to 35 also builds, but Play requires new
     * apps and updates to target 36 from 31 August 2026, so 35 is a temporary
     * measure and not the committed state.
     */
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        /*
         * IMMUTABLE once the first release reaches Play. Changing it later is a
         * new listing with zero installs and zero reviews.
         *
         * Older notes in android-config/build-gradle-notes.md said
         * `com.bilbymobile.app`. Those notes are wrong and the mismatch caused a
         * silent App Links verification failure: assetlinks.json names this
         * value, so a package that disagrees with it means every deep link
         * opens the browser instead of the app, with no error anywhere.
         */
        applicationId = "com.bilbymobile.bilby"

        // eSIM needs 22; 23 is the safer floor, and it is also where runtime
        // permissions begin, so nothing below it is worth supporting.
        minSdk = 23
        targetSdk = 36

        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasKeystore) {
            create("release") {
                storeFile = file(keyProps.getProperty("storeFile"))
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            isMinifyEnabled = shrink
            isShrinkResources = shrink
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )

            if (!shrink) {
                versionNameSuffix = "-noshrink"
            }
        }

        debug {
            // The trial build talks to a dev backend over plain HTTP. See
            // res/xml/network_security_config.xml for why that needs declaring.
            applicationIdSuffix = ""
        }
    }
}

flutter {
    source = "../.."
}
