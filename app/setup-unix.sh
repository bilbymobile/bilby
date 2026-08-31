#!/usr/bin/env bash
# macOS / Linux equivalent of setup-windows.ps1. Same five steps.
set -euo pipefail
cd "$(dirname "$0")"

command -v flutter >/dev/null || { echo "flutter not on PATH — install the SDK first"; exit 1; }
echo "[0/5] $(flutter --version | head -1)"

echo "[1/5] android/ host project"
if [ -f android/app/src/main/AndroidManifest.xml ]; then echo "  skip (exists)"
else
  # flutter create can overwrite pubspec.yaml depending on version, silently
  # dropping every dependency. Back it up and restore if that happens.
  cp pubspec.yaml pubspec.yaml.bak
  flutter create . --org com.bilbymobile --platforms=android --project-name bilby >/dev/null
  grep -q google_mobile_ads pubspec.yaml || { cp pubspec.yaml.bak pubspec.yaml; echo "  (pubspec.yaml restored)"; }
  rm -f pubspec.yaml.bak
  echo "  created"
fi

echo "[2/5] network security config"
mkdir -p android/app/src/main/res/xml
cp android-config/network_security_config.xml android/app/src/main/res/xml/

echo "[3/5] AndroidManifest.xml"
M=android/app/src/main/AndroidManifest.xml
grep -q 'permission.INTERNET' $M || python3 - "$M" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=re.sub(r'(<manifest[^>]*>)', r'''\1
    <uses-permission android:name="android.permission.INTERNET" />
    <!-- Required from Android 13 to read the advertising ID. Without it every
         ad request looks non-personalised and eCPM collapses. -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />''', s, count=1)
if 'networkSecurityConfig' not in s:
    s=s.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"',1)
if 'ads.APPLICATION_ID' not in s:
    s=s.replace('</application>','''
        <!-- Google TEST app id. Replace before any release build. -->
        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
                   android:value="ca-app-pub-3940256099942544~3347511713" />
        <meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION"
                   android:value="true" />
    </application>''',1)
open(p,'w').write(s); print("  patched")
PY

echo "[4/5] compileSdk/targetSdk 36"
G=android/app/build.gradle.kts; [ -f "$G" ] || G=android/app/build.gradle
if [ -f "$G" ]; then
  sed -i.bak -E 's/compileSdk( *=)? *flutter\.compileSdkVersion/compileSdk\1 36/; s/targetSdk( *=)? *flutter\.targetSdkVersion/targetSdk\1 36/; s/minSdk( *=)? *flutter\.minSdkVersion/minSdk\1 23/' "$G"
  rm -f "$G.bak"; echo "  $(basename $G) updated — install SDK Platform 36 in Android Studio"
fi

echo "[5/5] icons + deps"
cp -r ../brand/assets/android/mipmap-* android/app/src/main/res/ 2>/dev/null || echo "  icons skipped"
flutter pub get >/dev/null
echo
flutter analyze || true
echo
echo "Done. Start the backend (cd ../web && npm run dev), open app/ in Android Studio,"
echo "pick the 'bilby (dev)' run configuration, press Run."
