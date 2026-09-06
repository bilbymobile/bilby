# Proguard and R8 rules for the release build.
#
# Everything here fails at RUNTIME rather than at build time if it is wrong,
# which is the worst possible place to find out.

# 1. The Flutter embedding and our own platform channel.
#    MainActivity is instantiated by name from AndroidManifest.xml, so nothing
#    in the code references it and the shrinker will happily delete it.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class com.bilbymobile.bilby.MainActivity { *; }

# 2. Anything reflected over by the eUICC API.
-keep class android.telephony.euicc.** { *; }
-dontwarn android.telephony.euicc.**

# 3. Play Core, which this app does not use and cannot remove.
#
#    The Flutter embedding always compiles in PlayStoreDeferredComponentManager
#    and FlutterPlayStoreSplitApplication whether or not deferred components are
#    used. Those reference com.google.android.play.core.*, which Google split
#    into separate artifacts and no longer ships as one library. Nothing
#    resolves them, R8 treats a missing referenced class as an error, and
#    minifyReleaseWithR8 fails.
#
#    -dontwarn rather than -keep is correct: keeping a class that does not exist
#    does nothing. We are telling R8 these references are genuinely unreachable,
#    which they are.
-dontwarn com.google.android.play.core.**

# Keep line numbers in stack traces, and rename the source file so the mapping
# is still useful. Without this a Play Console crash report is a wall of a, b, c
# and you cannot tell which of your own methods threw.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
