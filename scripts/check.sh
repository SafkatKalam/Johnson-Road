#!/usr/bin/env bash
# F48: run every automated check in one go, the same way a CI service would. Read-only apart from test databases
# (throwaway, dropped afterwards) and a build folder in the system temp directory.
#   bash scripts/check.sh            (needs the local PostgreSQL container running for the database tests)
#   SKIP_DB=1 bash scripts/check.sh  (only the tests that need no database)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend/.venv-win/Scripts/python.exe"
[ -x "$PY" ] || PY="$ROOT/backend/.venv/bin/python"
[ -x "$PY" ] || PY="python3"
fail=0

step() { echo; echo "== $1"; }

step "backend tests"
if [ "${SKIP_DB:-0}" = "1" ]; then
  # Only the test files that need no database (pure engine, storage, token and settings tests).
  (cd "$ROOT/backend" && "$PY" -m pytest tests/test_engine_counting.py tests/test_storage.py tests/test_auth_tokens.py -q -p no:cacheprovider) || fail=1
else
  (cd "$ROOT/backend" && REQUIRE_DB=1 "$PY" -m pytest tests -q -p no:cacheprovider) || fail=1
fi

step "frontend typecheck"
(cd "$ROOT/frontend" && npx tsc --noEmit -p .) || fail=1

step "frontend lint"
(cd "$ROOT/frontend" && npx eslint src) || fail=1

step "frontend production build"
OUT="$(mktemp -d)"
(cd "$ROOT/frontend" && npx vite build --outDir "$OUT" --emptyOutDir >/dev/null) || fail=1
rm -rf "$OUT"

step "no secrets in tracked files"
# Real Supabase secret keys look like sb_secret_<random>; test placeholders start with sb_secret_test and are allowed.
if (cd "$ROOT" && git grep -nE "sb_secret_[A-Za-z0-9]|SUPABASE_SECRET_KEY=[^ \n]+[A-Za-z0-9]{8}" -- ':!*.example' ':!scripts/check.sh' 2>/dev/null | grep -v "sb_secret_test" | grep -q .); then
  echo "possible secret committed (see: git grep sb_secret_)"; fail=1
fi

echo
if [ "$fail" = "0" ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit "$fail"
