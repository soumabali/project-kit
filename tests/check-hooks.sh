#!/usr/bin/env bash
# Hook behavior: the secret guard blocks credential-looking writes and allows removals; the session hook prints
# context in project-kit projects and follows the setup option (ask, auto, off) everywhere else.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUARD="$ROOT/scripts/secret-guard.sh"
SESSION="$ROOT/scripts/session-context.sh"
failures=0
expect() { # label, wanted exit code, command...
  local label="$1" want="$2"; shift 2
  "$@" >/dev/null 2>&1; local got=$?
  if [ "$got" != "$want" ]; then echo "    $label: exit $got, wanted $want"; failures=$((failures + 1)); fi
}
problem() { echo "    $1"; failures=$((failures + 1)); }
guard() { printf '%s' "$1" | bash "$GUARD"; }
json_write() { C="$1" node -e 'process.stdout.write(JSON.stringify({tool_name:"Write",tool_input:{file_path:"/p/f",content:process.env.C}}))'; }
json_edit() { O="$1" N="$2" node -e 'process.stdout.write(JSON.stringify({tool_name:"Edit",tool_input:{file_path:"/p/f",old_string:process.env.O,new_string:process.env.N}}))'; }

# Split so this file itself never matches. tests/check-guard.mjs covers the formats; these check the hook wiring.
AWS="AKIA""Q3ZTR7XW2LMNP5KD"
PK="-----BEGIN ""RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA7bq9xY2mRkT3pL8vN4wQ5sZ1cH6jU0fG9aB2dE5tK7oL3nM8"
GH="ghp_""aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

expect "clean code allowed" 0 guard "$(json_write 'const x = 1;')"
expect ".env.example placeholder allowed" 0 guard "$(json_write 'AWS_ACCESS_KEY_ID=')"
expect "AWS key blocked" 2 guard "$(json_write "key=$AWS")"
expect "private key blocked" 2 guard "$(json_write "$PK")"
expect "GitHub token in an edit blocked" 2 guard "$(json_edit 'token: env' "token: $GH")"
expect "removing a key allowed" 0 guard "$(json_edit "key=$AWS" 'key=os.environ["K"]')"
expect "test-mode key prefix in docs allowed" 0 guard "$(json_write 'Use sk_test_ keys in staging')"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
TMP="$(cd "$TMP" && pwd -P)"
DATA="$TMP/plugin-data"
# session <dir> <setup option> [source]: run the hook the way Claude Code does, outside CI.
session() {
  printf '{"hook_event_name":"SessionStart","source":"%s"}' "${3:-startup}" |
    env -u CI CLAUDE_PROJECT_DIR="$1" CLAUDE_PLUGIN_DATA="$DATA" CLAUDE_PLUGIN_OPTION_SETUP="$2" bash "$SESSION"
}
repo() { mkdir -p "$1" && git -C "$1" init -q; }

# Outside a git repository: silent, whatever the option.
mkdir -p "$TMP/plain"
[ -z "$(session "$TMP/plain" ask)" ] || problem "session hook printed output outside a git repository"
[ -z "$(session "$TMP/plain" auto)" ] && [ ! -e "$TMP/plain/CLAUDE.md" ] || problem "auto setup ran outside a git repository"

# ask (the default): one notice at startup with the exact skip command; nothing on resume or compaction.
repo "$TMP/ask"
out="$(session "$TMP/ask" ask)"
echo "$out" | grep -q '/project-kit:kickoff' || problem "ask mode did not mention /project-kit:kickoff"
echo "$out" | grep -q "skip --project-dir \"$TMP/ask\" --data-dir \"$DATA\"" || problem "ask mode did not print the skip command"
[ ! -e "$TMP/ask/CLAUDE.md" ] || problem "ask mode wrote files"
[ -z "$(session "$TMP/ask" ask resume)" ] || problem "ask notice repeated on resume"
[ -z "$(session "$TMP/ask" ask compact)" ] || problem "ask notice repeated after compaction"
[ -n "$(env -u CLAUDE_PLUGIN_OPTION_SETUP CLAUDE_PROJECT_DIR="$TMP/ask" bash "$SESSION" </dev/null)" ] || problem "an unset option should behave as ask"
[ -n "$(session "$TMP/ask" something-else)" ] || problem "an unknown option value should behave as ask"
[ -z "$(printf '{}' | CI=true CLAUDE_PROJECT_DIR="$TMP/ask" bash "$SESSION")" ] || problem "session hook offered setup in CI"
node "$ROOT/scripts/kit.mjs" skip --project-dir "$TMP/ask" --data-dir "$DATA" >/dev/null || problem "kit.mjs skip failed"
[ -z "$(session "$TMP/ask" ask)" ] || problem "skipped repo still got the notice"
[ -z "$(session "$TMP/ask" auto)" ] && [ ! -e "$TMP/ask/CLAUDE.md" ] || problem "auto setup ran in a skipped repo"

# off: silent.
repo "$TMP/off"
[ -z "$(session "$TMP/off" off)" ] || problem "off mode printed output"

# auto: installs at the repo root with detected apps, then prints the note and the resume point.
repo "$TMP/auto"
mkdir -p "$TMP/auto/web" && echo '{"dependencies":{"next":"15.0.0"}}' > "$TMP/auto/web/package.json"
[ -z "$(session "$TMP/auto/web" auto)" ] && [ ! -e "$TMP/auto/CLAUDE.md" ] && [ ! -e "$TMP/auto/web/CLAUDE.md" ] || problem "auto setup ran from a subfolder"
out="$(session "$TMP/auto" auto)"
[ -f "$TMP/auto/CLAUDE.md" ] && [ -f "$TMP/auto/.claude/project-kit.json" ] && [ -f "$TMP/auto/.claude/rules/kit/stack-nextjs.md" ] || problem "auto setup did not install the project layer"
echo "$out" | grep -q 'Apps: web=nextjs:web' || problem "auto note did not list the detected app"
echo "$out" | grep -q "uninstall --project-dir \"$TMP/auto\"" || problem "auto note did not print the undo command"
echo "$out" | grep -q 'Next step: finish Phase 00' || problem "auto setup did not print the new STATUS.md"
out="$(session "$TMP/auto/web" auto)"
echo "$out" | grep -q '\[05-progress/STATUS.md\]' || problem "a session in a subfolder of a kit project did not get STATUS.md"
echo "$out" | grep -q 'Automatic setup' && problem "auto setup ran twice"

# auto never edits an existing CLAUDE.md (or writes through a link named CLAUDE.md): it falls back to the notice.
repo "$TMP/mine"
echo '# My rules' > "$TMP/mine/CLAUDE.md"
out="$(session "$TMP/mine" auto)"
echo "$out" | grep -q 'Automatic setup skipped: CLAUDE.md already exists' || problem "auto mode did not explain why it skipped"
[ "$(cat "$TMP/mine/CLAUDE.md")" = '# My rules' ] && [ ! -e "$TMP/mine/.claude/project-kit.json" ] || problem "auto mode touched an existing CLAUDE.md"
repo "$TMP/linked-claude"
ln -s "$TMP/elsewhere.md" "$TMP/linked-claude/CLAUDE.md"
session "$TMP/linked-claude" auto | grep -q 'Automatic setup skipped: CLAUDE.md already exists' || problem "auto mode ignored a dangling CLAUDE.md link"
[ ! -e "$TMP/elsewhere.md" ] || problem "auto mode wrote through a CLAUDE.md link"

# auto runs only when a conversation starts, and a failed install leaves nothing behind.
repo "$TMP/later"
[ -z "$(session "$TMP/later" auto compact)" ] && [ ! -e "$TMP/later/CLAUDE.md" ] || problem "auto setup ran after compaction"
[ -z "$(session "$TMP/later" auto resume)" ] && [ ! -e "$TMP/later/CLAUDE.md" ] || problem "auto setup ran on resume"
repo "$TMP/badjson"
mkdir -p "$TMP/badjson/.claude" && printf '{ "model": "sonnet", }\n' > "$TMP/badjson/.claude/settings.json"
session "$TMP/badjson" auto | grep -q 'Automatic setup skipped: .claude/settings.json is not valid JSON' || problem "auto mode hid an install failure"
[ ! -e "$TMP/badjson/CLAUDE.md" ] && [ ! -e "$TMP/badjson/01-ideas" ] || problem "a failed auto setup left files behind"

# auto skips linked worktrees (the main checkout owns setup).
repo "$TMP/main"
git -C "$TMP/main" -c user.name=t -c user.email=t@example.com commit -q --allow-empty -m init
git -C "$TMP/main" worktree add -q "$TMP/linked" 2>/dev/null
[ -z "$(session "$TMP/linked" auto)" ] && [ ! -e "$TMP/linked/CLAUDE.md" ] || problem "auto setup ran in a linked worktree"

# Uninstall undoes an automatic setup and records the repo so setup isn't offered again.
node "$ROOT/scripts/kit.mjs" uninstall --project-dir "$TMP/auto" --data-dir "$DATA" >/dev/null || problem "uninstall failed"
[ ! -e "$TMP/auto/CLAUDE.md" ] && [ ! -e "$TMP/auto/.claude" ] && [ ! -e "$TMP/auto/.gitignore" ] && [ ! -e "$TMP/auto/.gitattributes" ] || problem "uninstall left kit files behind"
[ -z "$(session "$TMP/auto" auto)" ] && [ ! -e "$TMP/auto/CLAUDE.md" ] || problem "auto setup reinstalled after uninstall"

# Context for an installed project: STATUS.md and git status, capped well under the 10,000-character limit.
repo "$TMP/kit"
mkdir -p "$TMP/kit/.claude" "$TMP/kit/05-progress"; echo '{}' > "$TMP/kit/.claude/project-kit.json"
session "$TMP/kit" ask | grep -q "no 05-progress/STATUS.md" || problem "session hook missed the missing STATUS.md"
printf '# STATUS\nNext step: test\n' > "$TMP/kit/05-progress/STATUS.md"
out="$(session "$TMP/kit" ask)"
echo "$out" | grep -q "Next step: test" || problem "session hook did not print STATUS.md"
echo "$out" | grep -q "\[git status\]" || problem "session hook did not print git status"
head -c 20000 /dev/zero | tr '\0' 'A' > "$TMP/kit/05-progress/STATUS.md"
size="$(session "$TMP/kit" ask | wc -c)"
[ "$size" -lt 10000 ] || problem "session hook output not capped ($size chars)"
# A full STATUS.md plus a long git status still fits.
for i in $(seq 1 60); do printf 'line %02d %s\n' "$i" "$(head -c 95 /dev/zero | tr '\0' 'b')"; done > "$TMP/kit/05-progress/STATUS.md"
long="$(head -c 150 /dev/zero | tr '\0' 'x')"
for i in $(seq 1 30); do mkdir -p "$TMP/kit/$long/$i" && : > "$TMP/kit/$long/$i/$long.txt"; done
git -C "$TMP/kit" add -A
size="$(session "$TMP/kit" ask | wc -c)"
[ "$size" -lt 10000 ] || problem "session hook output with a long git status not capped ($size chars)"

[ "$failures" -eq 0 ] || { echo "  $failures hook check(s) failed"; exit 1; }
