#!/usr/bin/env bash
# PreToolUse hook for every write path (Write, Edit, MultiEdit, NotebookEdit, Bash, PowerShell): blocks a call whose
# new content or command holds what looks like a real credential. Exit 2 blocks the call and shows stderr to Claude.
# gitleaks (its full rule set) runs when installed; the patterns below are the fallback and cover the common
# formats. This is the first line of defense; gitleaks in the pre-commit hook and in CI is the thorough one.
input="$(cat)"

# The text to scan. If no parser works, scan the raw event rather than nothing.
q='[.tool_input.content, .tool_input.new_string, .tool_input.new_source, .tool_input.command,
    ((.tool_input.edits // [])[]?.new_string)] | map(select(type == "string")) | join("\n")'
py='import json, sys
t = json.load(sys.stdin).get("tool_input", {})
v = [t.get(k) for k in ("content", "new_string", "new_source", "command")]
v += [e.get("new_string") for e in (t.get("edits") or []) if isinstance(e, dict)]
print("\n".join(x for x in v if isinstance(x, str)))'
if command -v jq >/dev/null 2>&1 && text="$(printf '%s' "$input" | jq -r "$q" 2>/dev/null)"; then :
elif command -v python3 >/dev/null 2>&1 && text="$(printf '%s' "$input" | python3 -c "$py" 2>/dev/null)"; then :
else text="$input"; fi
[ -n "$text" ] || exit 0

block() {
  echo "Blocked by the project-kit secret guard: $1. Read secrets from environment variables, put only placeholders in .env.example, and ask the user to set real values." >&2
  exit 2
}

if command -v gitleaks >/dev/null 2>&1; then
  printf '%s' "$text" | gitleaks stdin --no-banner --redact --log-level error >/dev/null 2>&1
  [ $? -eq 1 ] && block "gitleaks found a credential"
fi

# One extended regex per line. A private key counts only with key material after its header, so code that builds a
# PEM from an environment variable passes. A function, because bash 3.2 (macOS) can't parse this heredoc in $(...).
patterns() {
  cat <<'EOF'
(A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}
-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----[^$`{}"']{0,120}[A-Za-z0-9+/]{40,}
PuTTY-User-Key-File-[0-9]+: [a-z0-9-]+
(sk|rk)_(live|prod)_[0-9A-Za-z]{16,}
whsec_[0-9A-Za-z]{24,}
sk-ant-[0-9A-Za-z_-]{20,}
sk-(proj|svcacct|admin)-[0-9A-Za-z_-]{20,}
sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}
gh[pousr]_[0-9A-Za-z]{36,}
github_pat_[0-9A-Za-z_]{40,}
gl(pat|rt|dt|ptt|cbt|ft|imt|soat|oas|agent|ffct)-[0-9A-Za-z_-]{20,}
xox[abeoprs]-[0-9A-Za-z-]{10,}
xapp-[0-9]-[A-Z0-9]+-[0-9]+-[a-z0-9]+
hooks\.slack\.com/(services|workflows|triggers)/[A-Za-z0-9+/]{20,}
AIza[0-9A-Za-z_-]{35}
GOCSPX-[0-9A-Za-z_-]{24,}
npm_[0-9A-Za-z]{36}
pypi-AgEIcHlwaS5vcmc[0-9A-Za-z_-]{40,}
hf_[0-9A-Za-z]{30,}
SG\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{40,}
do[por]_v1_[0-9a-f]{64}
[0-9]{8,10}:AA[0-9A-Za-z_-]{33}
(SB-)?Mid-server-[0-9A-Za-z_-]{20,}
xnd_(development|production)_[0-9A-Za-z+/=]{30,}
[a-zA-Z0-9_~.]{3}[0-9]Q~[a-zA-Z0-9_~.-]{31,34}
APP_KEY=base64:[A-Za-z0-9+/]{40,}
(^|[^A-Za-z0-9_])[A-Z0-9_]*(SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*=["']?[A-Za-z0-9+/_.=-]{20,}
[a-z][a-z0-9+.-]*://[^/:@ "'`]+:[^/@ "'`$]{6,}@[^ "'`/:]+
EOF
}
# Placeholders, documented example keys, and local development URLs are not secrets.
hits="$(printf '%s' "$text" | tr '\n' ' ' | sed 's/\\n/ /g' | grep -Eo -e "$(patterns)" |
  grep -Eiv 'example|your|xxxx|placeholder|changeme|change_me|dummy|redacted|<[a-z_-]+>|@(localhost|127\.0\.0\.1|db|postgres|mysql|mariadb|redis|mongo|database)$')"
[ -n "$hits" ] && block "the new content contains what looks like a real credential"
exit 0
