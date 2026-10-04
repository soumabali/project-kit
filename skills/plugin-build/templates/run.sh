#!/usr/bin/env bash
# Copy to tests/run.sh. `bash tests/run.sh` validates every plugin and the marketplace, then runs each other tests/*.sh.
set -u
cd "$(dirname "$0")/.." || exit 1
failed=0
tmp=""
trap '[ -z "$tmp" ] || rm -rf "$tmp"' EXIT
command -v claude >/dev/null 2>&1 || { echo "FAIL  claude not found: install Claude Code to validate the plugin"; exit 1; }

# Validate each manifest by its file path. On a folder holding both plugin.json and marketplace.json, validate checks
# only the marketplace; a plugin.json path also checks that plugin's skills, agents, and commands.
targets=()
while IFS= read -r m; do targets+=("$m"); done < <(find . \( -name node_modules -o -name .git \) -prune -o \
  \( -path '*/.claude-plugin/plugin.json' -o -path ./.claude-plugin/marketplace.json \) -print | sort)
if [ ${#targets[@]} -eq 0 ] && [ -f SKILL.md ]; then # a standalone skill: validate it inside a skills folder
  tmp="$(mktemp -d)"; mkdir -p "$tmp/skills/skill"; cp SKILL.md "$tmp/skills/skill/"; targets=("$tmp/skills")
fi
[ ${#targets[@]} -gt 0 ] || targets=(.) # skills, agents, or commands folders with no manifest
for t in "${targets[@]}"; do
  name="$t"; [ -z "$tmp" ] || [ "$t" != "$tmp/skills" ] || name=SKILL.md
  if out="$(claude plugin validate --strict "$t" 2>&1)"; then echo "ok    validate $name"; else printf '%s\n' "$out"; echo "FAIL  validate $name"; failed=1; fi
done

for t in tests/*.sh; do
  [ -f "$t" ] && [ "$t" != tests/run.sh ] || continue
  if bash "$t"; then echo "ok    $t"; else echo "FAIL  $t"; failed=1; fi
done
[ "$failed" -eq 0 ]
