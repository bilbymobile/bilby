# Fixes the "cmdline-tools component is missing" / "Android license status
# unknown" pair that blocks every Flutter Android build.
#
# Launched by fix-android-sdk.bat — you should not need to run this directly.
#
# What it does, in order:
#   1. Finds your Android SDK (env var, then registry, then the usual places)
#   2. Points JAVA_HOME at Android Studio's bundled JBR — sdkmanager is a Java
#      program and fails with an unhelpful error without a JDK
#   3. Downloads the current command-line tools, resolving the URL from Google's
#      own package index rather than a hardcoded link that goes stale
#   4. Extracts them into cmdline-tools\latest\ — the nesting everyone gets wrong
#   5. Sets ANDROID_HOME and PATH permanently (user scope, no admin needed)
#   6. Installs platform-tools, API 36 and build-tools
#   7. Accepts all SDK licences
#   8. Re-runs flutter doctor
#
# Safe to re-run. Every step checks before it acts.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # makes Invoke-WebRequest far faster

function Say($m, $c = "White") { Write-Host $m -ForegroundColor $c }
function Ok($m)   { Say "  [ok]   $m" "Green" }
function Info($m) { Say "  ...    $m" "DarkGray" }
function Warn($m) { Say "  [warn] $m" "Yellow" }
function Die($m)  { Say ""; Say "  [FAIL] $m" "Red"; Say ""; Read-Host "Press Enter to close"; exit 1 }

Say ""
Say "==========================================" "Cyan"
Say " Android SDK fix-up for Flutter" "Cyan"
Say "==========================================" "Cyan"

# ── 1. Locate the SDK ──────────────────────────────────────────────────────
Say ""
Say "[1/8] Locating your Android SDK"

$sdk = $null
foreach ($candidate in @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:USERPROFILE\AppData\Local\Android\Sdk",
    "C:\Android\Sdk"
)) {
    if ($candidate -and (Test-Path $candidate)) { $sdk = $candidate; break }
}

# Android Studio records the SDK path in the registry when it installs one.
if (-not $sdk) {
    foreach ($key in @(
        "HKCU:\SOFTWARE\Android Studio",
        "HKLM:\SOFTWARE\Android Studio",
        "HKLM:\SOFTWARE\WOW6432Node\Android Studio"
    )) {
        try {
            $p = (Get-ItemProperty -Path $key -ErrorAction Stop).SdkPath
            if ($p -and (Test-Path $p)) { $sdk = $p; break }
        } catch { }
    }
}

if (-not $sdk) {
    Warn "Could not find your Android SDK automatically."
    Say ""
    Say "  Open Android Studio -> Tools -> SDK Manager and copy the"
    Say "  'Android SDK Location' shown at the top of that dialog."
    Say ""
    $sdk = (Read-Host "  Paste the Android SDK Location").Trim('"').Trim()
    if (-not (Test-Path $sdk)) { Die "That path does not exist: $sdk" }
}
Ok "SDK: $sdk"

# ── 2. Java ────────────────────────────────────────────────────────────────
Say ""
Say "[2/8] Checking Java (sdkmanager needs it)"

$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path "$jbr\bin\java.exe") {
    # Android Studio ships a JetBrains Runtime. Using it avoids the very common
    # "JAVA_HOME is not set" failure and guarantees a compatible version.
    $env:JAVA_HOME = $jbr
    $env:PATH = "$jbr\bin;$env:PATH"
    Ok "Using Android Studio's bundled JBR"
} elseif (Get-Command java -ErrorAction SilentlyContinue) {
    Ok "Using the java already on your PATH"
} else {
    Die "No Java found. Install Android Studio, or install JDK 17+ and set JAVA_HOME."
}

# ── 3 & 4. Command-line tools ──────────────────────────────────────────────
Say ""
Say "[3/8] Command-line tools"

$cmdlineBin = Join-Path $sdk "cmdline-tools\latest\bin"
$sdkmanager = Join-Path $cmdlineBin "sdkmanager.bat"

if (Test-Path $sdkmanager) {
    Ok "Already installed"
} else {
    # Resolve the download URL from Google's package index. Hardcoding a link
    # like commandlinetools-win-14742923_latest.zip works until Google bumps the
    # build number, and then this script silently 404s a year from now.
    $base = "https://dl.google.com/android/repository/"
    $zipUrl = $null
    try {
        Info "Asking Google for the current version"
        $body = (Invoke-WebRequest -Uri "${base}repository2-3.xml" -UseBasicParsing -TimeoutSec 40).Content

        # Regex rather than XML traversal on purpose. repository2-3.xml is
        # namespaced (sdk:sdk-repository), and PowerShell's dot-notation XML
        # adapter handles namespace prefixes inconsistently across versions —
        # so $xml.'sdk-repository'.remotePackage silently returns nothing on
        # some machines. The filename pattern is stable and unambiguous.
        $found = [regex]::Matches($body, 'commandlinetools-win-\d+_latest\.zip')
        if ($found.Count -gt 0) {
            # Several builds can be listed; take the highest build number.
            $newest = $found |
                ForEach-Object { $_.Value } |
                Sort-Object { [long]($_ -replace '\D', '') } |
                Select-Object -Last 1
            $zipUrl = $base + $newest
            Ok "Found $newest"
        }
    } catch {
        Warn "Could not read the package index: $($_.Exception.Message)"
    }

    if (-not $zipUrl) {
        $zipUrl = "${base}commandlinetools-win-14742923_latest.zip"
        Warn "Falling back to a known build. If this 404s, download manually from"
        Warn "https://developer.android.com/studio#command-line-tools-only"
    }

    $zip = Join-Path $env:TEMP "android-cmdline-tools.zip"
    Info "Downloading $([IO.Path]::GetFileName($zipUrl))"
    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 600
    } catch {
        Die "Download failed: $($_.Exception.Message)`n  Check your network/proxy, or download manually."
    }
    Ok "Downloaded"

    Say ""
    Say "[4/8] Extracting into cmdline-tools\latest"

    # THE gotcha. The zip contains a top-level folder called 'cmdline-tools',
    # but the SDK requires <sdk>\cmdline-tools\latest\bin\sdkmanager.bat.
    # Extracting naively gives you cmdline-tools\bin (missing 'latest') or
    # cmdline-tools\cmdline-tools\bin (one level too deep). Either produces
    # exactly the "component is missing" error you are trying to fix.
    $staging = Join-Path $env:TEMP "android-cmdline-staging"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $staging -Force

    $extracted = Join-Path $staging "cmdline-tools"
    if (-not (Test-Path $extracted)) {
        # Some builds omit the wrapper folder; handle both shapes.
        $extracted = $staging
    }

    $target = Join-Path $sdk "cmdline-tools\latest"
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Move-Item -Path $extracted -Destination $target -Force

    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $sdkmanager)) {
        Die "Extraction finished but sdkmanager.bat is not at:`n  $sdkmanager"
    }
    Ok "cmdline-tools\latest installed"
}

# ── 5. Environment ─────────────────────────────────────────────────────────
Say ""
Say "[5/8] Setting ANDROID_HOME and PATH (user scope, no admin)"

[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")
$env:ANDROID_HOME = $sdk
Ok "ANDROID_HOME = $sdk"

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
$added = @()
foreach ($dir in @($cmdlineBin, (Join-Path $sdk "platform-tools"))) {
    if ($userPath -notlike "*$dir*") {
        $userPath = ($userPath.TrimEnd(';') + ";" + $dir).TrimStart(';')
        $added += $dir
    }
    $env:PATH = "$dir;$env:PATH"
}
if ($added.Count) {
    [Environment]::SetEnvironmentVariable("Path", $userPath, "User")
    $added | ForEach-Object { Ok "PATH += $_" }
} else {
    Ok "PATH already correct"
}

# ── 6. Packages ────────────────────────────────────────────────────────────
Say ""
Say "[6/8] Installing platform-tools, API 36 and build-tools"
Info "First run downloads a few hundred MB — this takes a while"

# API 36 specifically: Google Play requires new apps to target it from
# 31 August 2026, and the project is configured accordingly.
& $sdkmanager --sdk_root="$sdk" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
if ($LASTEXITCODE -ne 0) {
    Warn "sdkmanager returned $LASTEXITCODE — continuing, but check the output above"
} else {
    Ok "Packages installed"
}

# ── 7. Licences ────────────────────────────────────────────────────────────
Say ""
Say "[7/8] Accepting SDK licences"

# sdkmanager --licenses prompts y/N per licence. Piping a generous run of 'y'
# answers all of them; there is no non-interactive flag.
$yes = ("y`n" * 60)
$yes | & $sdkmanager --sdk_root="$sdk" --licenses | Out-Null
Ok "Licences accepted"

# ── 8. Verify ──────────────────────────────────────────────────────────────
Say ""
Say "[8/8] Re-running flutter doctor"
Say ""

if (Get-Command flutter -ErrorAction SilentlyContinue) {
    flutter config --android-sdk "$sdk" | Out-Null
    flutter doctor
} else {
    Warn "flutter is not on this shell's PATH — run 'flutter doctor' yourself."
}

Say ""
Say "==========================================" "Cyan"
Say " Done" "Cyan"
Say "==========================================" "Cyan"
Say ""
Say "If Android toolchain is now [ok], you are clear to build:" "White"
Say ""
Say '  cd "C:\Nav\Nextwave\Products\n eSim\bilby-app\app"'
Say "  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1"
Say ""
Say "Close and reopen any terminals or Android Studio windows first," "DarkGray"
Say "so they pick up the new ANDROID_HOME and PATH." "DarkGray"
Say ""
Read-Host "Press Enter to close"
