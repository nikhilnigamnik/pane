#!/bin/sh
# Starts a compiled pane binary on a scratch folder and checks that the UI, the API and file
# watching answer. The release workflow runs it on every platform it ships.
#
#   scripts/smoke-test.sh path/to/pane

set -eu

bin=$1
work=$(mktemp -d)
log="$work/server.log"
events="$work/events.txt"
pid=""
events_pid=""

stop() {
  [ -n "$1" ] || return 0
  kill "$1" 2>/dev/null || true
  # Waiting reaps the job, so the shell does not report it as terminated.
  wait "$1" 2>/dev/null || true
}

cleanup() {
  stop "$events_pid"
  stop "$pid"
  rm -rf "$work"
}
trap cleanup EXIT

fail() {
  echo "FAIL $1"
  echo "--- server log"
  cat "$log" 2>/dev/null || true
  exit 1
}

pass() {
  echo "ok   $1"
}

mkdir -p "$work/project/src/deep"
printf 'hello from pane\n' > "$work/project/src/a.txt"
printf 'nested\n' > "$work/project/src/deep/b.txt"

version=$("$bin" --version) || fail "--version"
pass "--version prints $version"

"$bin" "$work/project" --no-open > "$log" 2>&1 &
pid=$!

base=""
tries=0
while [ -z "$base" ]; do
  tries=$((tries + 1))
  [ "$tries" -le 50 ] || fail "server did not print its address"
  sleep 0.2
  base=$(grep -oE 'http://127\.0\.0\.1:[0-9]+' "$log" | head -n 1 || true)
done
pass "server started on $base"

index=$(curl -fsS "$base/") || fail "GET /"
case "$index" in
  *'<div id="root">'*) pass "UI page" ;;
  *) fail "UI page has no app root" ;;
esac

asset=$(printf '%s' "$index" | grep -oE '/assets/[^"]+\.js' | head -n 1)
[ -n "$asset" ] || fail "UI page links no script"
type=$(curl -fsS -o /dev/null -w '%{content_type}' "$base$asset") || fail "GET $asset"
case "$type" in
  text/javascript*) pass "UI script" ;;
  *) fail "UI script served as $type" ;;
esac

file=$(curl -fsS "$base/api/file?path=src/a.txt") || fail "GET /api/file"
case "$file" in
  *'hello from pane'*) pass "read a file" ;;
  *) fail "read a file: $file" ;;
esac

mtime=$(printf '%s' "$file" | grep -oE '"mtimeMs":[0-9.]+' | cut -d: -f2)
saved=$(curl -fsS -X PUT -H 'Content-Type: application/json' \
  -d "{\"path\":\"src/a.txt\",\"content\":\"saved\\n\",\"expectedMtimeMs\":$mtime}" \
  "$base/api/file") || fail "PUT /api/file"
[ "$(cat "$work/project/src/a.txt")" = "saved" ] || fail "save did not reach the disk: $saved"
pass "save a file"

found=$(curl -fsS "$base/api/search?query=nested") || fail "GET /api/search"
case "$found" in
  *'src/deep/b.txt'*) pass "search" ;;
  *) fail "search: $found" ;;
esac

escape=$(curl -sS "$base/api/file?path=../outside.txt")
case "$escape" in
  *outside_workspace*) pass "path outside the folder is refused" ;;
  *) fail "path outside the folder: $escape" ;;
esac

foreign=$(curl -sS -H 'Host: example.com' "$base/api/meta")
case "$foreign" in
  *forbidden*) pass "foreign Host is refused" ;;
  *) fail "foreign Host: $foreign" ;;
esac

curl -sN "$base/api/events" > "$events" 2>/dev/null &
events_pid=$!
sleep 1
printf 'changed\n' > "$work/project/src/deep/b.txt"
tries=0
until grep -q 'src/deep/b.txt' "$events"; do
  tries=$((tries + 1))
  [ "$tries" -le 25 ] || fail "no change event for a file in a nested folder"
  sleep 0.2
done
pass "change event for a file in a nested folder"

echo "all checks passed"
