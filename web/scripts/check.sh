#!/usr/bin/env bash
#
# Everything that has to pass before a deploy.
#
# One script rather than three commands, because a check that has to be
# remembered is a check that gets skipped on the day it would have caught
# something. Needs DATABASE_URL pointing at a Postgres it is allowed to write
# to: every one of these talks to a real database, which is the whole point.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── vercel.json ───────────────────────────────────────"
npx tsx scripts/vercel-json.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── types ──────────────────────────────────────────────"
npx tsc --noEmit -p tsconfig.json
echo "clean"

echo
echo "── first run on an empty database ────────────────────"
if [ -n "${VIRGIN_DATABASE_URL:-}" ]; then
  DATABASE_URL="$VIRGIN_DATABASE_URL" npx tsx scripts/firstrun.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'
else
  echo "skipped: set VIRGIN_DATABASE_URL to an EMPTY database to run this"
fi

echo
echo "── guards: rate limiting and error tracking ───────────"
 npx tsx scripts/guards.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── the public catalogue publishes no economics ───────"
npx tsx scripts/catalog-privacy.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── the landing page claims only what is on sale ──────"
npx tsx scripts/live-destinations.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── the console bootstrap window ──────────────────────"
npx tsx scripts/bootstrap.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── the money path ────────────────────────────────────"
npx tsx scripts/money.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── the webhook ───────────────────────────────────────"
npx tsx scripts/webhook.test.ts 2>/dev/null | grep -E '^(  FAIL|[0-9]+ passed)'

echo
echo "── build ─────────────────────────────────────────────"
npm run build 2>&1 | grep -E 'Compiled|error|Failed'
