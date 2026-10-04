#!/usr/bin/env bash
# PreToolUse hook for Bash and PowerShell: blocks git commands that force-push or skip the project's hooks, in the
# forms permission rules can't see (git -C <dir>, git --no-pager, quoted flags, environment variables, chained or
# nested commands). git-guard.awk reads the command the way a shell does, so commit messages that only mention
# these flags pass. Exit 2 blocks the call and shows stderr to Claude.
DIR="$(cd "$(dirname "$0")" && pwd)"
input="$(cat)"
py='import json, sys
c = json.load(sys.stdin).get("tool_input", {}).get("command")
print(c if isinstance(c, str) else "")'
if command -v jq >/dev/null 2>&1 && cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"; then :
elif command -v python3 >/dev/null 2>&1 && cmd="$(printf '%s' "$input" | python3 -c "$py" 2>/dev/null)"; then :
else # no JSON parser (Git Bash on Windows): decode the "command" string with awk
  cmd="$(printf '%s' "$input" | awk '
    { s = s $0 "\n" }
    END {
      if (!match(s, /"command"[ \t\r\n]*:[ \t\r\n]*"/)) exit
      for (p = RSTART + RLENGTH; p <= length(s); p++) {
        c = substr(s, p, 1)
        if (c == "\"") break
        if (c == "\\") {
          p++; d = substr(s, p, 1)
          if (d == "n") c = "\n"; else if (d == "t") c = "\t"; else if (d == "r") c = "\r"; else c = d
        }
        out = out c
      }
      printf "%s", out
    }')"
fi
case "$cmd" in *[Gg][Ii][Tt]*) ;; *) exit 0 ;; esac

reason="$(printf '%s\n' "$cmd" | awk -f "$DIR/git-guard.awk")"
case $? in
  0) exit 0 ;;
  1) echo "Blocked by the project-kit git guard: $reason. Don't look for another way to run it; if the user wants it, they run it themselves." >&2
     exit 2 ;;
  *) echo "project-kit git guard couldn't check this command; the permission rules still apply." >&2
     exit 0 ;;
esac
