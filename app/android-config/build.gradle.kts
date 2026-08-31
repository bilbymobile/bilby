import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Signing secrets, read from android/key.properties, which is gitignored and
// never committed. build-release.ps1 writes this file.
//
// Loaded conditionally so a fresh clone with no keystore can still run debug
// builds. A missing key.properties must not break `flutter run`; it must only
// stop a release from being signed with the wrong key, which is handled below.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKey = keystorePropertiesFile.exists()
if (hasReleaseKey) {
    // Read as UTF-8 and strip a leading byte order mark.
    //
    // Properties.load(InputStream) decodes ISO-8859-1 by the spec, so a file
    // written by Windows PowerShell with -Encoding UTF8 arrives with its BOM
    // intact and the first key becomes "\uFEFFstoreFile". Every lookup of
    // "storeFile" then returns null, and the build dies eight lines later with
    // "null cannot be cast to non-null type kotlin.String", which names neither
    // the file nor the key nor the encoding. Three invisible bytes, and the
    // error message points at the wrong line.
    keystorePropertiesFile.reader(Charsets.UTF_8).use { r ->
        keystoreProperties.load(r)
    }
    val bom = keystoreProperties.keys.map { it as String }.filter { it.startsWith("\uFEFF") }
    bom.forEach { k ->
        keystoreProperties[k.removePrefix("\uFEFF")] = keystoreProperties[k]
        keystoreProperties.remove(k)
    }
}

/**
 * Required signing property, or a failure that says what is wrong.
 *
 * The cast this replaces produced "null cannot be cast to non-null type
 * kotlin.String" and nothing else. Naming the key and the file turns a
 * half hour of guessing into a ten second fix.
 */
fun signingProperty(key: String): String =
    keystoreProperties[key] as String?
        ?: throw GradleException(
            "android/key.properties has no \"$key\". Found: " +
                keystoreProperties.keys.joinToString(", ") +
                ". Delete the file and re-run build-release.ps1 to rewrite it."
        )

android {
    namespace = "com.bilbymobile.bilby"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Immutable once published. Changing it later means a new listing with
        // zero installs and zero reviews.
        applicationId = "com.bilbymobile.bilby"

        // 23 is deliberate. eSIM needs Android 9, but the app must still install
        // on older handsets so it can tell those users honestly that their phone
        // cannot take a profile. Refusing to install earns a one star review;
        // explaining does not.
        minSdk = flutter.minSdkVersion

        // Play requires 36 for all new apps and updates from 31 August 2026.
        // Below this the bundle is rejected at upload, not at review.
        targetSdk = 36

        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = signingProperty("keyAlias")
                keyPassword = signingProperty("keyPassword")
                storeFile = file(signingProperty("storeFile"))
                storePassword = signingProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // The default Flutter template signs release with the DEBUG key so
            // that `flutter run --release` works out of the box. That is a
            // sensible default for a template and a disaster for a real app:
            // Play rejects a debug signed bundle outright, and if it did not,
            // shipping one would mean publishing under a key you do not control.
            //
            // So: use the real key when we have one, and otherwise leave the
            // debug key in place for local release runs.
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            // Shrink and obfuscate. Flutter ships proguard rules for its own
            // engine; this only affects the Java and Kotlin side, which for this
            // app is the eSIM capability channel and the ads SDK.
            //
            // Set BILBY_SHRINK=false in the environment to build an otherwise
            // identical release APK with R8 switched off. That exists as a
            // one command bisect: a release crash that disappears when this is
            // false is a missing keep rule, and a release crash that survives it
            // is in our own code. Guessing between those two costs an evening,
            // and the difference is one environment variable.
            //
            // NEVER ship an unshrunk build to Play. The preflight in
            // build-release.ps1 refuses to build a bundle while this is set.
            val shrink = System.getenv("BILBY_SHRINK")?.lowercase() != "false"
            if (!shrink) {
                logger.lifecycle("BILBY: R8 DISABLED for this build. Diagnostic only, do not upload.")
            }
            isMinifyEnabled = shrink
            isShrinkResources = shrink
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
