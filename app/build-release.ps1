<#
    build-release.ps1

    Everything between "the code is written" and "there is an .aab I can upload",
    with the two irreversible steps guarded.

    Run it with no arguments the first time. It will create a keystore, wire the
    signing config, verify the things Play rejects uploads for, and build.

        .\build-release.ps1

    Once AdMob has issued a real rewarded unit (which only happens AFTER the app
    is published, see PLAYBOOK.md Phase 5):

        .\build-release.ps1 -AdUnit "ca-app-pub-XXXXXXXXXXXX/YYYYYYYYYY"

    Two things this script cannot undo for you, and both end the product:
      * Losing the keystore means you can never update the app again.
      * Publishing the applicationId fixes it forever.
    Both are checked and shouted about below.
#>

param(
    <#
        Two origins, deliberately.

        $ApiBase is compiled into the binary and is therefore permanent: every
        installed copy carries this string, Android users update slowly, and
        some never do. It points at a hostname that serves nothing but the API,
        so the marketing site can be rebuilt on anything and the web app can
        move hosts without stranding an install.

        $SiteBase is the apex. It is what the Play listing declares as the
        developer website, where app-ads.txt must resolve without a redirect,
        and where the legal pages live. Play, AdMob and the privacy policy link
        all have to name the same hostname, and this is it.
    #>
    [string]$ApiBase  = "https://api.bilbymobile.com",
    [string]$SiteBase = "https://bilbymobile.com",
    [string]$AdUnit   = "",
    [string]$KeyStore = "$env:USERPROFILE\keys\bilby-release.jks",
    [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Say ($m, $c = "Gray") { Write-Host $m -ForegroundColor $c }
function Ok   ($m) { Say "  OK    $m" "Green" }
function Warn ($m) { Say "  WARN  $m" "Yellow" }
function Die  ($m) { Say "  STOP  $m" "Red"; exit 1 }
function Head ($m) { Say ""; Say $m "Cyan" }

# Google's public test unit. Correct for every build before publication, because
# AdMob will not create a live unit for an unpublished app. Never ship a debug
# build against real inventory: that is how accounts get suspended for invalid
# traffic, and suspension is very hard to reverse.
$TEST_UNIT = "ca-app-pub-3940256099942544/5224354917"

<#
    Locate keytool.

    It ships inside the JDK, and almost nobody installing Android Studio ends up
    with a JDK on PATH, because Android Studio bundles its own JetBrains Runtime
    inside the application folder and never adds it. So `keytool` is present on
    the machine and simply invisible to the shell, which produces a
    CommandNotFoundException that reads like the JDK is missing when it is not.

    Six places, cheapest first. The `flutter doctor` probe is last because it
    takes several seconds, but it is the most reliable: Flutter already had to
    solve this exact problem to run Gradle at all, so its answer is the one the
    build itself will use.
#>
function Find-Keytool {
    $cmd = Get-Command keytool -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @()

    if ($env:JAVA_HOME) { $candidates += "$env:JAVA_HOME\bin\keytool.exe" }

    # Android Studio's bundled runtime, across the install locations it uses.
    # `jbr` is current; `jre` is what older releases shipped.
    $candidates += @(
        "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe"
        "$env:ProgramFiles\Android\Android Studio\jre\bin\keytool.exe"
        "${env:ProgramFiles(x86)}\Android\Android Studio\jbr\bin\keytool.exe"
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr\bin\keytool.exe"
        "$env:LOCALAPPDATA\JetBrains\Toolbox\apps\AndroidStudio\ch-0\*\jbr\bin\keytool.exe"
    )

    foreach ($c in $candidates) {
        $hit = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }

    # Ask Flutter. `flutter doctor -v` prints "Java binary at: <path>\java",
    # and keytool sits beside it in the same bin directory.
    Say "  looking for a JDK via flutter doctor, this takes a moment"
    $doctor = & flutter doctor -v 2>&1 | Out-String
    if ($doctor -match "Java binary at:\s*(.+?java(?:\.exe)?)\s*$") {
        $java = $Matches[1].Trim()
        $kt = Join-Path (Split-Path $java) "keytool.exe"
        if (Test-Path $kt) { return $kt }
    }

    # Last resort: sweep Program Files, depth limited. Unbounded -Recurse from
    # a drive root can take minutes on a large disk, which is worse than
    # failing, because it looks like a hang.
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, "$env:LOCALAPPDATA\Programs")) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Filter "keytool.exe" -Recurse -Depth 4 `
                     -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    return $null
}

Say ""
Say "  Bilby release build" "White"
Say "  ===================" "White"

# ── 1. The keystore ─────────────────────────────────────────────────────────
Head "[1/6] Signing key"

if (Test-Path $KeyStore) {
    Ok "keystore found at $KeyStore"
    $age = (Get-Item $KeyStore).LastWriteTime
    Say "        created $age"
} else {
    Warn "No keystore at $KeyStore"
    Say ""
    Say "  About to create one. Read this first." "White"
    Say "  This file is the ONLY thing that proves a future update came from you."
    Say "  Lose it and you cannot update the app, ever. You would publish a new"
    Say "  listing at a new package name with zero installs and zero reviews."
    Say ""
    Say "  After it is created, copy it to at least two places you will still"
    Say "  control in five years. A password manager and an external drive."
    Say ""
    $keytool = Find-Keytool
    if (-not $keytool) {
        Say ""
        Die @"
Could not find keytool anywhere.

It comes with the JDK. Android Studio bundles one but does not put it on PATH,
which is why the shell cannot see it. Two ways forward:

  1. Point the script at Android Studio's bundled runtime, usually:
     `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
     then re-run this script.

  2. Or install a standalone JDK 17 (Temurin is fine) and reopen PowerShell.

If Android Studio is installed somewhere unusual, find it with:
  Get-ChildItem C:\ -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue |
    Select-Object -First 3 FullName
"@
    }
    Ok "keytool found at $keytool"

    New-Item -ItemType Directory -Force -Path (Split-Path $KeyStore) | Out-Null

    # 4096 bit RSA and 10000 days. The validity has to outlast the app: Play
    # rejects an upload signed with a key that expires before 2033.
    #
    # Invoked through the resolved absolute path rather than by name, because
    # the whole reason we are here is that the name does not resolve.
    & $keytool -genkeypair -v `
        -keystore $KeyStore `
        -keyalg RSA -keysize 4096 -validity 10000 `
        -alias bilby
    if ($LASTEXITCODE -ne 0) { Die "keytool failed. See the error above." }
    Ok "keystore created"
    Warn "BACK IT UP NOW, before you do anything else."
}

# ── 2. Signing config ───────────────────────────────────────────────────────
Head "[2/6] Signing config"

$propsPath = "$root\android\key.properties"
if (-not (Test-Path "$root\android")) {
    Die "android\ does not exist. Run .\setup-windows.ps1 first."
}

<#
    Write key.properties as UTF-8 with NO byte order mark.

    `Set-Content -Encoding UTF8` on Windows PowerShell 5.1 prepends EF BB BF.
    Gradle loads this file with java.util.Properties, which decodes ISO-8859-1
    per its own spec, so those three bytes become part of the first key name:
    the file says storeFile and the map contains "\uFEFFstoreFile". Every
    lookup of storeFile returns null and the build fails with

        null cannot be cast to non-null type kotlin.String

    which names neither the file, nor the key, nor the encoding. It is the
    single most expensive three bytes in Android tooling.
#>
function Write-PropsFile ($Path, $Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $false))
}

if (Test-Path $propsPath) {
    # Repair a file written by an earlier run of this script, or by hand in an
    # editor that adds a BOM by default. Cheap to check, and the alternative is
    # the user meeting the cast error above.
    $bytes = [System.IO.File]::ReadAllBytes($propsPath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
        Write-PropsFile $propsPath $text
        Ok "android/key.properties had a UTF-8 BOM; stripped it"
        Say "        Gradle would otherwise have read the first key as"
        Say "        the invisible BOM plus storeFile, and failed with a null cast."
    } else {
        Ok "android/key.properties present"
    }
} else {
    Say "  Enter the passwords you just set."
    $storePw = Read-Host "  Keystore password" -AsSecureString
    $keyPw   = Read-Host "  Key password (Enter if the same)" -AsSecureString

    $sp = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePw))
    $kp = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPw))
    if ([string]::IsNullOrWhiteSpace($kp)) { $kp = $sp }

    # Forward slashes: Gradle treats a backslash as an escape character and a
    # Windows path silently resolves to nothing.
    $esc = $KeyStore -replace '\\', '/'
    $props = @"
storeFile=$esc
storePassword=$sp
keyAlias=bilby
keyPassword=$kp
"@
    Write-PropsFile $propsPath $props
    Ok "wrote android/key.properties"
}

# This file holds your signing passwords in plain text. It must never reach a
# repository, and .gitignore is the only thing standing between it and GitHub.
$gitignore = "$root\.gitignore"
$ig = if (Test-Path $gitignore) { Get-Content $gitignore -Raw } else { "" }
if ($ig -notmatch "key\.properties") {
    Add-Content $gitignore "`n# Signing secrets. Never commit.`nandroid/key.properties`n*.jks`n*.keystore`n"
    Ok "added key.properties and *.jks to .gitignore"
} else {
    Ok "key.properties already gitignored"
}

# Wire the config into build.gradle if setup-windows.ps1 has not already.
$gradle = Get-ChildItem "$root\android\app" -Filter "build.gradle*" | Select-Object -First 1
$g = Get-Content $gradle.FullName -Raw
if ($g -notmatch "key\.properties") {
    Warn "build.gradle has no signingConfig block."
    Warn "Add the release signingConfig from android-config/build-gradle-notes.md,"
    Warn "or the bundle is signed with the debug key and Play will reject it."
} else {
    Ok "build.gradle reads key.properties"
}

# ── 3. The things Play rejects uploads for ──────────────────────────────────
Head "[3/6] Pre-upload checks"

<#
    BILBY_SHRINK=false builds an unminified release APK for diagnosing crashes.
    It must never reach Play: an unshrunk bundle is larger, unobfuscated, and
    silently different from the artefact every check above just validated.

    This guard exists because a diagnostic environment variable set in one
    PowerShell session survives every later command in that session, so the
    build that eventually gets uploaded is exactly the one most likely to still
    have it set.
#>
if ($env:BILBY_SHRINK -eq "false") {
    Die @"
BILBY_SHRINK is set to false in this shell.

That switches R8 off, which is correct for diagnosing a crash and wrong for
anything you intend to upload. Clear it and run again:

  Remove-Item Env:BILBY_SHRINK

To build the diagnostic APK instead, do not use this script:

  flutter build apk --release --dart-define=API_BASE=$ApiBase --dart-define=ADMOB_REWARDED_ID=$TEST_UNIT
"@
}

if (-not $SkipChecks) {
    # API 36 became mandatory for new apps and updates on 31 August 2026. This
    # is not a warning at review time, it is a rejection at upload.
    if ($g -match "targetSdk\s*=?\s*(\d+)") {
        $target = [int]$Matches[1]
        if ($target -lt 36) {
            Die "targetSdk is $target. Play requires 36 since 31 Aug 2026. Re-run setup-windows.ps1."
        }
        Ok "targetSdk = $target"
    } else {
        Warn "Could not read targetSdk. Verify it is 36 by hand."
    }

    # applicationId is immutable once published. Catching a leftover template
    # value here costs a minute; catching it after publication costs the listing.
    if ($g -match 'applicationId\s*=?\s*"([^"]+)"') {
        $appId = $Matches[1]
        if ($appId -like "*example*") {
            Die "applicationId is still '$appId'. This is permanent once published."
        }
        Ok "applicationId = $appId"
    }

    # A release build talking to localhost is a broken app in the store.
    if ($ApiBase -match "localhost|127\.0\.0\.1|10\.0\.2\.2") {
        Die "API_BASE is $ApiBase. That is a development address."
    }
    Ok "API_BASE = $ApiBase"

    <#
        The legal pages must be REAL, not merely reachable.

        The first version of this check only asserted HTTP 200, and it passed
        against a parked domain. Registrar placeholders (Hostinger, GoDaddy,
        Namecheap and the rest) answer 200 on every path, so /privacy, /terms,
        /refunds and /app-ads.txt all "existed" while actually serving an advert
        for web hosting. A Play reviewer clicking through to that is an instant
        rejection, and the check that was supposed to prevent exactly that was
        the thing waving it through.

        So: fetch the content and prove it is ours. Parking detection first,
        because its failure message is the useful one.
    #>
    $parkingTells = @(
        "parked domain", "this domain is parked", "domain is for sale",
        "buy this domain", "hostinger", "godaddy", "namecheap",
        "sedo", "start your online journey", "future home of"
    )

    <#
        A phrase that must appear on each page.

        Two properties matter and they pull against each other. It has to be
        specific enough that a generic placeholder cannot satisfy it by
        accident, and stable enough that ordinary copy editing does not turn
        the check into a false STOP that blocks a legitimate build. The first
        version failed the second test: it looked for "data only" while the page
        said "data-only", so a correct deploy would have been rejected with a
        message pointing at a stale deploy that did not exist.

        These are anchored on legally required phrasing instead, which is the
        one part of the copy nobody rewrites on a whim.
    #>
    $expect = @{
        "privacy"      = "advertising id"
        "terms"        = "australian consumer law"
        "refunds"      = "australian consumer law"
        "app-ads.txt"  = "google.com"
    }

    foreach ($p in $expect.Keys) {
        $url = "$SiteBase/$p"
        try {
            $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 15
        } catch {
            Die "$url is not reachable. Deploy the web app before submitting."
        }

        if ($r.StatusCode -ne 200) { Die "$url returned $($r.StatusCode)." }

        $body = "$($r.Content)".ToLower()

        $hit = $parkingTells | Where-Object { $body -like "*$_*" } | Select-Object -First 1
        if ($hit) {
            Die @"
$url is a PARKED DOMAIN placeholder, not your site. Matched: "$hit"

The domain resolves and answers 200 on every path, which is why a plain
reachability check passes. A Play reviewer clicking your privacy policy link
would land on a hosting advert, and that is an instant rejection.

Deploy the web app and point the domain at it before building for submission:

  cd "..\web"
  npm i -g vercel
  vercel --prod

Then add bilbymobile.com in the Vercel dashboard and update the DNS records at
Hostinger to the ones Vercel gives you. Allow up to a few hours for DNS.

To build anyway for local testing only, re-run with -SkipChecks.
"@
        }

        if ($body -notlike "*$($expect[$p])*") {
            Die @"
$url answered 200 but does not look like the real page.

Expected to find "$($expect[$p])" in the body and did not. Either the deploy is
stale, the route is serving a fallback, or something else is answering for this
domain. Open it in a browser and look before going further.
"@
        }

        Ok "$url is live and looks correct"
    }

    <#
        app-ads.txt must answer on the apex WITHOUT a redirect.

        The IAB spec tolerates a hop and AdMob usually follows it, but "usually"
        is doing real work in that sentence and the failure mode is silent: the
        app stays in limited serving, the eCPM stays depressed, and the console
        never says why. Since the free tier is funded entirely by ad revenue,
        a redirect here is a permanent tax on the whole business model.

        -MaximumRedirection 0 makes PowerShell treat a 3xx as an error, so a
        redirect lands in the catch rather than being silently followed.
    #>
    try {
        Invoke-WebRequest "$SiteBase/app-ads.txt" -UseBasicParsing `
            -MaximumRedirection 0 -TimeoutSec 15 -ErrorAction Stop | Out-Null
        Ok "app-ads.txt answers on the apex with no redirect"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -ge 300 -and $code -lt 400) {
            Die @"
$SiteBase/app-ads.txt REDIRECTS ($code) instead of answering directly.

AdMob may follow it and may not, and when it does not, the only symptom is that
your app sits in limited ad serving forever with no error anywhere in the
console. For an ad funded free tier that is a permanent revenue haircut.

In Vercel, Settings, Domains: make the apex the primary and set www to redirect
to it, not the other way round.
"@
        }
        Die "$SiteBase/app-ads.txt is not reachable: $($_.Exception.Message)"
    }

    <#
        The API origin must actually be serving, because it is about to be
        frozen into the binary.

        This is the check that would have caught the worst version of this
        mistake: a build that passes every content check against a healthy
        marketing site while the hostname the app itself talks to has no DNS
        record at all. The app installs, opens, and shows a network error to
        every user, and nothing in the build output hinted at it.
    #>
    try {
        $api = Invoke-WebRequest "$ApiBase/api/me" -UseBasicParsing -TimeoutSec 15
    } catch {
        Die @"
$ApiBase/api/me is not reachable.

This is the origin that gets compiled into the binary, so a build made now would
ship an app that cannot talk to anything. Add $($ApiBase -replace '^https?://','')
as a domain on the Vercel project and wait for it to verify, then re-run.
"@
    }
    if ($api.StatusCode -ne 200 -or "$($api.Content)" -notlike "*balanceMb*") {
        Die "$ApiBase/api/me answered $($api.StatusCode) but not with the expected payload."
    }
    Ok "$ApiBase/api/me is live"
}

# ── 4. Ad unit ──────────────────────────────────────────────────────────────
Head "[4/6] Ad unit"

if ([string]::IsNullOrWhiteSpace($AdUnit)) {
    $AdUnit = $TEST_UNIT
    Ok "using Google's TEST unit"
    Say "        Correct for now. AdMob will not issue a live unit until the app"
    Say "        is published, so the first build always ships the test unit and"
    Say "        the real one goes in as an update."
} elseif ($AdUnit -eq $TEST_UNIT) {
    Warn "that is the test unit"
} else {
    Ok "using live unit $AdUnit"
    Say "        Confirm the SSV callback in AdMob points at:"
    Say "        $ApiBase/api/ads/ssv"
}

# ── 5. Build ────────────────────────────────────────────────────────────────
Head "[5/6] Building the app bundle"

<#
    Run an external command and capture everything it says.

    This exists because of a nasty PowerShell interaction. The script sets
    $ErrorActionPreference = "Stop" so that a genuine failure halts rather than
    limping onward. But with `2>&1`, PowerShell wraps every line a native
    program writes to stderr in a NativeCommandError record, and under "Stop"
    the FIRST such line becomes a terminating error.

    `flutter analyze` writes its summary line to stderr. So the script aborted
    on the very output it was about to display, and the four issues it found
    were never printed. The check designed to show you problems was hidden by
    one of them.

    Dropping to "Continue" for the duration of the call fixes it, and the exit
    code is captured before anything else can overwrite $LASTEXITCODE.
#>
function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)

    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & $Exe @Arguments 2>&1 | Out-String
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    return [pscustomobject]@{ Output = $out; ExitCode = $code }
}

Push-Location $root
try {
    Say "  cleaning"
    Invoke-Native "flutter" @("clean")   | Out-Null
    Invoke-Native "flutter" @("pub", "get") | Out-Null

    # Analyzer first. A failing analyze does not stop a build, but shipping a
    # release with known errors is how a preventable crash reaches a store
    # listing you cannot quickly update.
    Say "  running analyzer"
    $an = Invoke-Native "flutter" @("analyze")
    if ($an.ExitCode -ne 0) {
        Warn "flutter analyze reported problems:"
        Say ""
        # Print the whole thing. Truncating the analyzer output is how you end
        # up debugging the wrong error.
        $an.Output -split "`r?`n" | Where-Object { $_.Trim() } |
            ForEach-Object { Say "        $_" }
        Say ""
        $go = Read-Host "  Build anyway? (y/n)"
        if ($go -ne "y") { Die "Stopped so you can fix them." }
    } else { Ok "analyzer clean" }

    Say "  running tests"
    $t = Invoke-Native "flutter" @("test")
    if ($t.ExitCode -ne 0) {
        Warn "tests failed:"
        $lines = $t.Output -split "`r?`n"
        $picked = $lines | Where-Object { $_ -match "(FAILED|Expected:|Actual:|Which:|\+\d+ -\d+)" }

        # A filter that matches nothing prints nothing. The previous version
        # reported "tests failed:" followed by silence, which is worse than no
        # filtering at all: it looks like the script swallowed the failure.
        # Falling back to the raw tail means there is always something to read.
        if (-not $picked) {
            $picked = $lines | Where-Object { $_.Trim() } | Select-Object -Last 25
        }
        $picked | Select-Object -Last 25 | ForEach-Object { Say "        $_" }
    } else { Ok "tests pass" }

    Say "  building appbundle (this takes a few minutes)"
    $b = Invoke-Native "flutter" @(
        "build", "appbundle",
        "--dart-define=API_BASE=$ApiBase",
        "--dart-define=ADMOB_REWARDED_ID=$AdUnit"
    )
    Say $b.Output
    if ($b.ExitCode -ne 0) { Die "Build failed. See the output above." }
}
finally { Pop-Location }

# ── 6. Result ───────────────────────────────────────────────────────────────
Head "[6/6] Done"

$aab = "$root\build\app\outputs\bundle\release\app-release.aab"
if (Test-Path $aab) {
    $mb = [math]::Round((Get-Item $aab).Length / 1MB, 1)
    Ok "app-release.aab  ($mb MB)"
    Say ""
    Say "  $aab" "White"
    Say ""
    Say "  Next:" "White"
    Say "    1. Play Console, Production, Create new release, upload this file"
    Say "    2. Complete App content BEFORE the release: privacy policy, ads"
    Say "       declaration, content rating, target audience, data safety"
    Say "    3. Your organisation account is exempt from the 12 tester closed"
    Say "       test, so you can go straight to production"
    Say ""
    Say "  After it is live, and not before:" "White"
    Say "    4. Create the AdMob app and LINK it to the Play listing"
    Say "    5. Create a rewarded unit, set SSV to $ApiBase/api/ads/ssv"
    Say "    6. app-ads.txt is already on the apex; confirm the Play listing"
    Say "       website field says exactly $SiteBase, then allow 24h for the crawl"
    Say "    7. Re-run this script with -AdUnit and ship the update"
    Say ""
} else {
    Die "Build reported success but no .aab was produced."
}
