// Flutter Android host, committed rather than generated.
//
// `flutter create .` would produce most of this, but it also overwrites
// MainActivity.kt with a stub, drops the network security config and resets the
// SDK levels. Committing the folder makes the build reproducible from a clone
// and makes every value below reviewable in a diff, which is worth more than
// the convenience of regenerating it.
pluginManagement {
    val flutterSdkPath = run {
        val properties = java.util.Properties()
        file("local.properties").inputStream().use { properties.load(it) }
        val flutterSdkPath = properties.getProperty("flutter.sdk")
        require(flutterSdkPath != null) {
            "flutter.sdk not set in local.properties. Run any flutter command " +
                "in app/ once and the tool writes it for you."
        }
        flutterSdkPath
    }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // AGP 8.9.1 is the floor for compileSdk 36. Moving compileSdk down to 35
    // without also moving this down is fine; the reverse is not.
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
}

include(":app")
