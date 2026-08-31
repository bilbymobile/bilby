#!/usr/bin/env bash
# Local smoke-test harness: production build, mock supplier, simulated ads on.
# ALLOW_SIMULATED_ADS is the explicit override the dev endpoint demands — never
# set it on a real deployment.
cd "$(dirname "$0")" || exit 1
export ALLOW_SIMULATED_ADS=yes-i-know
export PORT=${PORT:-3100}
exec npx next start -p "$PORT"
