#!/usr/bin/env bash
# The git guard blocks force-pushes and skipped hooks in the forms permission rules miss (quoted flags, line
# continuations, abbreviations, environment variables, config overrides, nested and chained commands), and lets
# ordinary git commands and commit messages that only mention those flags through.
set -u
GUARD="$(cd "$(dirname "$0")/.." && pwd)/scripts/git-guard.sh"
failures=0
SHIMS="$(mktemp -d)"; trap 'rm -rf "$SHIMS"' EXIT
run() { C="$1" node -e 'process.stdout.write(JSON.stringify({tool_name:"Bash",tool_input:{command:process.env.C}}))' | bash "$GUARD" 2>/dev/null; }
expect() { # wanted exit (2 block, 0 allow), command
  run "$2"; local got=$?
  if [ "$got" != "$1" ]; then printf '    exit %s, wanted %s: %s\n' "$got" "$1" "$2"; failures=$((failures + 1)); fi
}
NL='
'
HEREDOC_MSG="git commit -m \"\$(cat <<'EOF'${NL}docs: why we never run git push -f, HUSKY=0 git commit, or --no-verify${NL}EOF${NL})\""

cases() {
  # Force-pushes
  expect 2 'git push -f origin main'
  expect 2 'git push --force-with-lease'
  expect 2 'git push origin main --force-with-lease=main:abc123'
  expect 2 'git push origin +main'
  expect 2 'git push --mirr'
  expect 2 'git push "-f" origin main'
  expect 2 "git push \\${NL} -f origin main"
  expect 2 'git --no-pager push -f origin main'
  expect 2 'git -C ../other push -uf origin task-001'
  expect 2 'cd api && git push --mirror'
  expect 2 '(cd api && git push -f)'
  expect 2 'echo $(git push -f origin main)'
  expect 2 'eval "git push -f origin main"'
  # Skipped hooks
  expect 2 'git commit -n -m "wip"'
  expect 2 'git commit -anm "wip"'
  expect 2 'git commit -am "wip" --no-verify'
  expect 2 'git commit --no-verif -m wip'
  expect 2 "git commit -m \"don't\" -n -m \"won't\""
  expect 2 'bash -c "git commit -n -m wip"'
  expect 2 'git merge --no-verify feature'
  expect 2 'SKIP=gitleaks git commit -m "wip"'
  expect 2 'HUSKY="0" git commit -m wip'
  expect 2 'HUSKY=0 git push origin task-001'
  expect 2 'export LEFTHOOK=0; git commit -m wip'
  expect 2 '$env:HUSKY=0; git commit -m "wip"'
  expect 2 'git -c core.hooksPath=/dev/null commit -m wip'
  expect 2 'git -c CORE.HOOKSPATH=/dev/null commit -m wip'
  expect 2 'HP=/dev/null git --config-env=core.hooksPath=HP commit -m wip'
  expect 2 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m wip'
  expect 2 'git config core.hooksPath /dev/null'
  expect 2 'git config --unset core.hooksPath'
  # Ordinary commands and messages that only mention the flags
  expect 0 "$HEREDOC_MSG"
  expect 0 "git commit -F - <<'EOF'${NL}mention git push -f and HUSKY=0 here${NL}EOF"
  expect 0 'git commit -m "docs: explain the -n flag"'
  expect 0 "git commit -m 'remove --no-verify and git push -f from scripts'"
  expect 0 'git commit -mn'
  expect 0 'git commit --amend --no-edit'
  expect 0 'git push -u origin task-001-login'
  expect 0 'git push origin feature-f'
  expect 0 'git push --dry-run origin main'
  expect 0 'git push -n origin main'
  expect 0 'git pull --rebase'
  expect 0 'git log --oneline -n 5'
  expect 0 'HUSKY=0 npm ci'
  expect 0 'git config core.hooksPath .husky/_'
  expect 0 'git config core.hooksPath'
  expect 0 'echo "git push -f"'
  expect 0 'npm test'

  # Without jq or python3 (Git Bash on Windows) the guard still reads the command.
  FAKE="$SHIMS/noparser"; mkdir -p "$FAKE"
  printf '#!/bin/sh\nexit 1\n' > "$FAKE/jq"; cp "$FAKE/jq" "$FAKE/python3"; chmod +x "$FAKE/jq" "$FAKE/python3"
  PATH="$FAKE:$PATH" expect 2 'git -C api push -f origin main'
  PATH="$FAKE:$PATH" expect 2 'git status && git commit -n -m "wip"'
  PATH="$FAKE:$PATH" expect 0 'git commit -m "explain the -n flag"'
  PATH="$FAKE:$PATH" expect 0 "$HEREDOC_MSG"
}

# The tokenizer must behave the same in every awk: mawk (Debian, Ubuntu), gawk (Git for Windows), the BSD awk on
# macOS (original-awk on Linux), and busybox. Each available one runs every case; CI installs the Linux ones.
seen=" "
for impl in awk mawk gawk original-awk nawk busybox; do
  bin="$(command -v "$impl" 2>/dev/null)" || continue
  real="$(readlink -f "$bin" 2>/dev/null || echo "$bin")"
  case "$seen" in *" $real "*) continue ;; esac
  seen="$seen$real "
  dir="$SHIMS/$impl"; mkdir -p "$dir"
  if [ "$impl" = busybox ]; then printf '#!/bin/sh\nexec "%s" awk "$@"\n' "$bin" > "$dir/awk"
  else printf '#!/bin/sh\nexec "%s" "$@"\n' "$bin" > "$dir/awk"; fi
  chmod +x "$dir/awk"
  before=$failures
  PATH="$dir:$PATH" cases
  [ "$failures" -eq "$before" ] || echo "    (the failures above ran with $impl: $real)"
  checked="${checked:-}${checked:+, }$impl"
done
[ -n "${checked:-}" ] || { echo "    no awk found"; exit 1; }

[ "$failures" -eq 0 ] || { echo "  $failures git guard check(s) failed"; exit 1; }
