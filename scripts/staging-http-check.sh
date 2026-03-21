#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://staging.xdragon.tech}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-https://stg-admin.xdragon.tech}"
ALLOW_SIDE_EFFECTS="${ALLOW_SIDE_EFFECTS:-0}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xdragon-staging-check.XXXXXX")"
COOKIE_JAR="$TMP_DIR/cookies.txt"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS_COUNT=0
WARN_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS: %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf 'WARN: %s\n' "$1" >&2
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

load_env_value() {
  local key="$1"
  local file line value
  for file in "$ROOT_DIR/.env.local" "$ROOT_DIR/.env"; do
    [[ -f "$file" ]] || continue
    line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
    [[ -n "$line" ]] || continue
    value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    printf '%s' "$value"
    return 0
  done
  return 1
}

http_status() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' "$url"
}

expect_ok_contains() {
  local url="$1"
  local pattern="$2"
  local label="$3"
  local body_file="$TMP_DIR/body.$RANDOM.txt"
  local status

  status="$(curl -sS -L "$url" -o "$body_file" -w '%{http_code}')"
  [[ "$status" == "200" ]] || fail "$label returned HTTP $status"
  grep -qi "$pattern" "$body_file" || fail "$label missing expected pattern: $pattern"
  pass "$label"
}

expect_redirect() {
  local url="$1"
  local expected_location="$2"
  local label="$3"
  local headers_file="$TMP_DIR/headers.$RANDOM.txt"
  local status location

  status="$(curl -sS -o /dev/null -D "$headers_file" -w '%{http_code}' "$url")"
  location="$(tr -d '\r' < "$headers_file" | awk 'tolower($1)=="location:" {print $2}' | tail -n 1)"

  [[ "$status" =~ ^30[1278]$ ]] || fail "$label expected redirect, got HTTP $status"
  [[ -n "$location" && "$location" == *"$expected_location"* ]] || fail "$label expected redirect to contain '$expected_location', got '${location:-<empty>}'"
  pass "$label"
}

expect_json_ok() {
  local url="$1"
  local payload="$2"
  local label="$3"
  local body_file="$TMP_DIR/json.$RANDOM.txt"
  local status

  status="$(curl -sS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -o "$body_file" \
    -w '%{http_code}' \
    --data "$payload")"

  [[ "$status" == "200" || "$status" == "202" ]] || fail "$label returned HTTP $status"
  node -e '
    const fs = require("fs");
    const p = process.argv[1];
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!body || body.ok !== true) process.exit(1);
  ' "$body_file" || fail "$label returned non-ok JSON"

  pass "$label"
}

load_optional_admin_creds() {
  [[ -n "$ADMIN_EMAIL" ]] || ADMIN_EMAIL="$(load_env_value ADMIN_EMAIL || true)"
  [[ -n "$ADMIN_PASSWORD" ]] || ADMIN_PASSWORD="$(load_env_value ADMIN_PASSWORD || true)"
}

run_basic_checks() {
  expect_ok_contains "$PUBLIC_BASE_URL/" "X Dragon Technologies" "Public home page loads"
  expect_ok_contains "$PUBLIC_BASE_URL/auth/signin" "Sign in" "Public sign-in page loads"
  expect_redirect "$PUBLIC_BASE_URL/tools" "/auth/signin" "Protected resources redirect anonymous users"
  expect_redirect "$ADMIN_BASE_URL/" "/admin/signin" "Admin host root redirects to admin sign-in"
  expect_ok_contains "$ADMIN_BASE_URL/admin/signin" "Sign in" "Admin sign-in page loads"
  expect_redirect "$ADMIN_BASE_URL/admin/dashboard" "/admin/signin" "Admin dashboard redirects anonymous users"

  local favicon_status
  favicon_status="$(http_status "$PUBLIC_BASE_URL/favicon.ico")"
  [[ "$favicon_status" == "200" ]] || fail "Favicon request returned HTTP $favicon_status"
  pass "Favicon responds successfully"
}

run_authenticated_checks() {
  load_optional_admin_creds

  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    warn "Authenticated checks skipped: admin credentials are not available in env or repo-local env files."
    return 0
  fi

  local csrf_json csrf_token signin_headers signin_status session_body session_status dashboard_status tools_status
  csrf_json="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$ADMIN_BASE_URL/api/auth/csrf")"
  csrf_token="$(node -e 'const body = JSON.parse(process.argv[1]); process.stdout.write(body.csrfToken || "");' "$csrf_json" 2>/dev/null || true)"
  [[ -n "$csrf_token" ]] || fail "Unable to fetch CSRF token for admin auth"

  signin_headers="$TMP_DIR/signin.headers.txt"
  signin_status="$(curl -sS \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    -o /dev/null \
    -D "$signin_headers" \
    -w '%{http_code}' \
    -X POST "$ADMIN_BASE_URL/api/auth/callback/credentials" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "csrfToken=$csrf_token" \
    --data-urlencode "email=$ADMIN_EMAIL" \
    --data-urlencode "password=$ADMIN_PASSWORD" \
    --data-urlencode "callbackUrl=$ADMIN_BASE_URL/admin/dashboard" \
    --data-urlencode 'json=true')"

  [[ "$signin_status" =~ ^20[0-9]$|^30[0-9]$ ]] || fail "Admin credential callback returned HTTP $signin_status"

  session_body="$TMP_DIR/session.json"
  session_status="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$session_body" -w '%{http_code}' "$ADMIN_BASE_URL/api/auth/session")"
  [[ "$session_status" == "200" ]] || fail "Auth session endpoint returned HTTP $session_status"
  node -e '
    const fs = require("fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!body || !body.user || !body.user.email) process.exit(1);
  ' "$session_body" || fail "Auth session did not contain a signed-in user"
  pass "Authenticated session established"

  dashboard_status="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' "$ADMIN_BASE_URL/admin/dashboard")"
  [[ "$dashboard_status" == "200" ]] || fail "Admin dashboard returned HTTP $dashboard_status after login"
  pass "Admin dashboard loads after login"

  tools_status="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' "$PUBLIC_BASE_URL/tools")"
  [[ "$tools_status" == "200" ]] || fail "Protected resources returned HTTP $tools_status after login"
  pass "Protected resources load after login"
}

run_optional_side_effect_checks() {
  if [[ "$ALLOW_SIDE_EFFECTS" != "1" ]]; then
    warn "Side-effect checks skipped. Set ALLOW_SIDE_EFFECTS=1 to run chat/contact write tests."
    return 0
  fi

  local ts email_marker
  ts="$(date +%s)"
  email_marker="qa+staging-${ts}@example.com"

  expect_json_ok \
    "$PUBLIC_BASE_URL/api/chat" \
    "{\"conversationId\":\"staging-check-${ts}\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"lead\":{}}" \
    "Chat API returns structured JSON"

  expect_json_ok \
    "$PUBLIC_BASE_URL/api/contact" \
    "{\"name\":\"Staging QA\",\"email\":\"${email_marker}\",\"phone\":\"\",\"message\":\"Automated staging contact test ${ts}. Ignore.\"}" \
    "Contact API accepts a test submission"
}

main() {
  printf 'Running staging HTTP checks\n'
  printf 'Public URL: %s\n' "$PUBLIC_BASE_URL"
  printf 'Admin URL: %s\n' "$ADMIN_BASE_URL"

  run_basic_checks
  run_authenticated_checks
  run_optional_side_effect_checks

  printf '\nSummary: %d passed, %d warnings\n' "$PASS_COUNT" "$WARN_COUNT"
}

main "$@"
