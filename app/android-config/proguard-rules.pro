# Proguard rules for the release build.
#
# Minification is on, which is worth roughly a megabyte and makes the Java and
# Kotlin side harder to read. Three things have to be kept, and each of them
# fails at RUNTIME rather than at build time if you get it wrong, which is the
# worst possible place to find out.

# 1. Google Mobile Ads.
#    The SDK resolves mediation adapters and several internal classes by name at
#    runtime. Minified, those lookups fail and every ad request returns no fill,
#    which looks exactly like an inventory problem rather than a build problem.
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# 2. The Flutter embedding and our own platform channel.
#    MainActivity is instantiated by name from AndroidManifest.xml, so nothing
#    in the code references it and the shrinker will happily delete it.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class com.bilbymobile.bilby.MainActivity { *; }

# 3. Anything reflected over by the eUICC API.
-keep class android.telephony.euicc.** { *; }
-dontwarn android.telephony.euicc.**

# Keep line numbers in stack traces, and rename the source file so the mapping
# is still useful. Without this a Play Console crash report is a wall of a, b, c
# and you cannot tell which of your own methods threw.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# 4. Play Core, which this app does not use and cannot remove.
#
#    The Flutter embedding always compiles in PlayStoreDeferredComponentManager
#    and FlutterPlayStoreSplitApplication, whether or not you use deferred
#    components. Those classes reference com.google.android.play.core.*, which
#    Google split into separate artifacts (feature-delivery, app-update and so
#    on) and no longer ships as one library. Nothing resolves them, R8 treats a
#    missing referenced class as an error, and minifyReleaseWithR8 fails.
#
#    -dontwarn rather than -keep is correct here: keeping a class that does not
#    exist does nothing. We are telling R8 that these references are genuinely
#    unreachable, which they are, because this app never calls a deferred
#    component. If deferred components are ever added, the real artifacts get
#    added with them and these lines become inert.
-dontwarn com.google.android.play.core.**
