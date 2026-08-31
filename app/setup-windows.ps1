# Bilby — one-shot Android project setup for Windows.
#
#   PS> cd C:\Nav\Nextwave\Products\n eSim\app
#   PS> powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
#
# Does the four fiddly steps that are easy to get wrong by hand:
#   1. Generates the android/ host project (it is not in the zip)
#   2. Installs the network security config — without it every call to your dev
#      server fails with an error that reads like "the backend is down"
#   3. Patches AndroidManifest.xml with the permissions and AdMob app id
#   4. Forces compileSdk/targetSdk to 36, which Play requires from 31 Aug 2026
#
# Safe to re-run: every step checks before it writes.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Say($msg, $colour = "White") { Write-Host $msg -ForegroundColor $colour }
function Ok($msg)   { Say "  OK    $msg" "Green" }
function Skip($msg) { Say "  skip  $msg" "DarkGray" }
function Warn($msg) { Say "  WARN  $msg" "Yellow" }

Say ""
Say "Bilby Android setup" "Cyan"
Say "===================" "Cyan"

# ── 0. Flutter present? ────────────────────────────────────────────────────
Say ""
Say "[0/5] Checking Flutter"
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Warn "flutter is not on your PATH."
    Say ""
    Say "  Install the Flutter SDK first: https://docs.flutter.dev/install"
    Say "  Then reopen PowerShell and run this script again."
    exit 1
}
$ver = (flutter --version 2>&1 | Select-Object -First 1)
Ok $ver

# ── 1. Generate the Android host project ───────────────────────────────────
Say ""
Say "[1/5] Generating android/ host project"
if (Test-Path "$root\android\app\src\main\AndroidManifest.xml") {
    Skip "android/ already exists"
} else {
    # `flutter create .` regenerates scaffolding, and depending on the Flutter
    # version it can overwrite pubspec.yaml — which would silently drop
    # google_mobile_ads, http, url_launcher and shared_preferences. Back it up
    # and restore it rather than trusting the tool not to touch it.
    Copy-Item "$root\pubspec.yaml" "$root\pubspec.yaml.bak" -Force
    flutter create . --org com.bilbymobile --platforms=android --project-name bilby | Out-Null

    $after = Get-Content "$root\pubspec.yaml" -Raw
    if ($after -notmatch 'google_mobile_ads') {
        Copy-Item "$root\pubspec.yaml.bak" "$root\pubspec.yaml" -Force
        Ok "android/ created (pubspec.yaml restored — flutter create had overwritten it)"
    } else {
        Ok "android/ created"
    }
    Remove-Item "$root\pubspec.yaml.bak" -Force -ErrorAction SilentlyContinue
}

# ── 2. Network security config ─────────────────────────────────────────────
Say ""
Say "[2/5] Installing network security config"
$xmlDir = "$root\android\app\src\main\res\xml"
New-Item -ItemType Directory -Force -Path $xmlDir | Out-Null
Copy-Item "$root\android-config\network_security_config.xml" "$xmlDir\network_security_config.xml" -Force
Ok "res/xml/network_security_config.xml"

# ── 2b. Install the native eSIM capability check ────────────────────────────
Say ""
Say "[2b/5] Installing MainActivity.kt (eSIM capability check)"
# flutter create writes a stub MainActivity with no method channels. The app's
# eSIM compatibility check needs one, so we overwrite it. Re-run this script
# after any `flutter create` or the check silently degrades to "unknown".
$ktDir = "$root\android\app\src\main\kotlin\com\bilbymobile\bilby"
if (Test-Path $ktDir) {
    Copy-Item "$root\android-config\MainActivity.kt" "$ktDir\MainActivity.kt" -Force
    Ok "kotlin/com/bilbymobile/bilby/MainActivity.kt"
} else {
    Warn "Kotlin source dir not found at $ktDir - skipped. eSIM check will report 'unknown'."
}

# ── 2c. Release signing and proguard ───────────────────────────────────────
Say ""
Say "[2c/5] Installing release signing config"
# flutter create writes a build.gradle.kts that signs RELEASE builds with the
# DEBUG key, so that `flutter run --release` works out of the box. Play rejects
# a debug signed bundle outright. Overwrite it with the version that reads
# android/key.properties, and drop in the proguard rules alongside.
$appDir = "$root\android\app"
if (Test-Path $appDir) {
    Copy-Item "$root\android-config\build.gradle.kts" "$appDir\build.gradle.kts" -Force
    Copy-Item "$root\android-config\proguard-rules.pro" "$appDir\proguard-rules.pro" -Force
    Ok "android/app/build.gradle.kts (release signing, minify, proguard)"
} else {
    Warn "android/app not found - skipped. Release builds would ship debug signed."
}

# ── 3. Patch the manifest ──────────────────────────────────────────────────
Say ""
Say "[3/5] Patching AndroidManifest.xml"
$manifestPath = "$root\android\app\src\main\AndroidManifest.xml"
$m = Get-Content $manifestPath -Raw

if ($m -notmatch 'android\.permission\.INTERNET') {
    $m = $m -replace '(<manifest[^>]*>)', @'
$1
    <!-- The app is a pure API client; without this nothing loads. -->
    <uses-permission android:name="android.permission.INTERNET" />
    <!-- Required from Android 13 to read the advertising ID. Omit it and every
         ad request looks non-personalised, which collapses eCPM. Since ad
         revenue funds the entire free tier, this line is worth real money. -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
'@
    Ok "permissions added"
} else { Skip "permissions already present" }

if ($m -notmatch 'networkSecurityConfig') {
    # Built by concatenation on purpose: '$1' must stay single-quoted so
    # PowerShell does not expand it as a variable, and the attribute needs
    # doubled quotes inside a double-quoted string.
    $nsc = '$1' + "`n        android:networkSecurityConfig=""@xml/network_security_config"""
    $m = $m -replace '(<application\b)', $nsc
    Ok "networkSecurityConfig wired"
} else { Skip "networkSecurityConfig already set" }

if ($m -notmatch 'com\.google\.android\.gms\.ads\.APPLICATION_ID') {
    $adsMeta = @'

        <!-- Google's TEST AdMob app id. Safe in development; MUST be replaced
             with your real id before a release build or ads will not serve.
             The Ads SDK crashes on start if this is missing entirely. -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-3940256099942544~3347511713" />
        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION"
            android:value="true" />
        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING"
            android:value="true" />
'@
    $m = $m -replace '(\s*</application>)', "$adsMeta`$1"
    Ok "AdMob app id added (test id)"
} else { Skip "AdMob app id already present" }

Set-Content $manifestPath $m -NoNewline
Ok "manifest saved"

# ── 4. Force API 36 ────────────────────────────────────────────────────────
Say ""
Say "[4/5] Setting compileSdk / targetSdk to 36"
$gradleKts = "$root\android\app\build.gradle.kts"
$gradleOld = "$root\android\app\build.gradle"
$gradlePath = if (Test-Path $gradleKts) { $gradleKts } else { $gradleOld }

if (Test-Path $gradlePath) {
    $g = Get-Content $gradlePath -Raw
    # Flutter's template usually defers to flutter.compileSdkVersion. Pin the
    # literal instead — Play requires API 36 for new apps from 31 Aug 2026 and
    # the template will lag behind that for a while.
    $g = $g -replace 'compileSdk\s*=\s*flutter\.compileSdkVersion', 'compileSdk = 36'
    $g = $g -replace 'compileSdk\s+flutter\.compileSdkVersion',     'compileSdk 36'
    $g = $g -replace 'targetSdk\s*=\s*flutter\.targetSdkVersion',   'targetSdk = 36'
    $g = $g -replace 'targetSdk\s+flutter\.targetSdkVersion',       'targetSdk 36'
    $g = $g -replace 'minSdk\s*=\s*flutter\.minSdkVersion',         'minSdk = 23'
    $g = $g -replace 'minSdk\s+flutter\.minSdkVersion',             'minSdk 23'
    Set-Content $gradlePath $g -NoNewline
    Ok "$(Split-Path $gradlePath -Leaf) updated"
    Warn "Install 'Android SDK Platform 36' in Android Studio's SDK Manager,"
    Warn "or the build fails with 'failed to find target with hash string android-36'."
} else {
    Warn "build.gradle not found — set compileSdk/targetSdk to 36 by hand."
}

# ── 5. Icons + dependencies ────────────────────────────────────────────────
Say ""
Say "[5/5] Icons and dependencies"
$icons = Join-Path (Split-Path $root -Parent) "brand\assets\android"
if (Test-Path $icons) {
    Copy-Item "$icons\mipmap-*" "$root\android\app\src\main\res\" -Recurse -Force
    Ok "launcher icons copied"
} else {
    Warn "brand\assets\android not found — icons skipped"
}

flutter pub get | Out-Null
Ok "dependencies resolved"

Say ""
Say "Running flutter analyze (expect some findings — the Dart has never been compiled)" "DarkGray"
Say ""
flutter analyze

Say ""
Say "Done." "Cyan"
Say ""
Say "Next:" "White"
Say "  1. Start the backend:   cd ..\web  &&  npm run dev"
Say "  2. Open THIS folder (app\) in Android Studio — not app\android\"
Say "  3. Pick the 'bilby (dev)' run configuration and press Run"
Say ""
