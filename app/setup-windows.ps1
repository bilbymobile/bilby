# Bilby — Android setup is no longer a step.
#
# This script used to run `flutter create .` and then copy MainActivity.kt, the
# network security config and the Gradle files over the generated scaffold.
#
# `app/android/` is now a real committed project, so there is nothing to
# generate and nothing to copy. Running the old script today would OVERWRITE
# the committed host project with a generated stub: the eSIM capability check
# would silently start answering "unknown" for everybody, the applicationId
# would revert, and the launcher icons would go back to Flutter's default.
#
# It is kept as this guard rather than deleted so that muscle memory and old
# notes hit an explanation instead of a missing file.

Write-Host ""
Write-Host "Nothing to set up." -ForegroundColor Cyan
Write-Host ""
Write-Host "  app/android/ is committed. From app/ just run:" -ForegroundColor White
Write-Host ""
Write-Host "      flutter pub get" -ForegroundColor Green
Write-Host "      flutter run --dart-define=API_BASE=http://10.0.2.2:3000 ``" -ForegroundColor Green
Write-Host "                  --dart-define=APP_BASE=http://10.0.2.2:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  See app/README.md. Do NOT run 'flutter create' in this folder:" -ForegroundColor Yellow
Write-Host "  it would overwrite the committed Android project." -ForegroundColor Yellow
Write-Host ""
exit 1
