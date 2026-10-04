#!/usr/bin/env bash
# Hook tests: feed recorded PreToolUse events to a hook script and check its exit code (2 blocks, 0 allows).
# Copy to tests/, point HOOK at your script, and list allowed and blocked cases for each hook. The cases run again
# with jq and python3 broken, the way the hook runs on a machine without a JSON parser, and on a Mac with /bin/bash
# 3.2, which Claude Code uses there unless a newer bash comes first in PATH.
set -u
HOOK="${HOOK:-$(cd "$(dirname "$0")/.." && pwd)/hooks/protect-env.sh}"
failures=0
event() { T="$1" P="$2" node -e 'process.stdout.write(JSON.stringify({hook_event_name:"PreToolUse",tool_name:process.env.T,tool_input:{file_path:process.env.P,content:"x"}}))'; }
expect() { # wanted exit, tool, path
  event "$2" "$3" | "${HOOK_BASH:-bash}" "$HOOK" 2>/dev/null; local got=$?
  if [ "$got" != "$1" ]; then echo "    $2 $3 (${HOOK_BASH:-bash}): exit $got, wanted $1"; failures=$((failures + 1)); fi
}
cases() {
  expect 2 Write /repo/.env
  expect 2 Edit /repo/api/.env.production
  expect 2 Write 'C:\repo\.env'
  expect 0 Write /repo/.env.example
  expect 0 Edit /repo/src/env.ts
  expect 0 Write /repo/README.md
}
cases

FAKE="$(mktemp -d)"; trap 'rm -rf "$FAKE"' EXIT
printf '#!/bin/sh\nexit 1\n' > "$FAKE/jq"; cp "$FAKE/jq" "$FAKE/python3"; chmod +x "$FAKE/jq" "$FAKE/python3"
PATH="$FAKE:$PATH" cases
if [ -x /bin/bash ] && /bin/bash -c '[ "${BASH_VERSINFO[0]}" -lt 4 ]' 2>/dev/null; then HOOK_BASH=/bin/bash cases; fi

[ "$failures" -eq 0 ] || { echo "  $failures hook check(s) failed"; exit 1; }
