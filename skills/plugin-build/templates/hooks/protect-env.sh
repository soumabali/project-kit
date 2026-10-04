#!/usr/bin/env bash
# Example PreToolUse hook (matcher: Write|Edit|MultiEdit|NotebookEdit): blocks edits to .env files, but not to
# .env.example. Shows the parsing pattern every hook should use: jq, then python3, then a POSIX fallback, so the
# hook still decides correctly on machines without a JSON parser (Git Bash on Windows). Exit 2 blocks the call and
# shows stderr to Claude; exit 0 allows it.
input="$(cat)"
py='import json, sys
t = json.load(sys.stdin).get("tool_input", {})
print(t.get("file_path") or t.get("notebook_path") or "")'
if command -v jq >/dev/null 2>&1 && file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)"; then :
elif command -v python3 >/dev/null 2>&1 && file="$(printf '%s' "$input" | python3 -c "$py" 2>/dev/null)"; then :
else
  file="$(printf '%s' "$input" | tr '\n' ' ' | sed -nE 's/.*"(file_path|notebook_path)"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\2/p')"
fi

name="${file##*/}"
name="${name##*\\}"
case "$name" in
  .env.example) exit 0 ;;
  .env|.env.*)
    echo "Blocked: $name holds real configuration. Put placeholders in .env.example and ask the user to set real values." >&2
    exit 2 ;;
esac
exit 0
