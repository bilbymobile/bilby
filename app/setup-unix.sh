#!/usr/bin/env bash
# Bilby — Android setup is no longer a step. See setup-windows.ps1 for the full
# explanation; the short version is that app/android/ is committed, so running
# `flutter create` here would overwrite it with a generated stub.
cat <<'MSG'

Nothing to set up.

  app/android/ is committed. From app/ just run:

      flutter pub get
      flutter run --dart-define=API_BASE=http://10.0.2.2:3000 \
                  --dart-define=APP_BASE=http://10.0.2.2:3000

  See app/README.md. Do NOT run 'flutter create' in this folder: it would
  overwrite the committed Android project.

MSG
exit 1
