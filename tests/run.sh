#!/usr/bin/env bash
# Self-test for project-kit. Run from anywhere: bash tests/run.sh
# Needs Node 22+ and bash; Python with Pillow and Claude Code are optional (those checks are skipped without them).
set -u
cd "$(dirname "$0")/.." || exit 1
passed=0 failed=0 skipped=0
step() { # label, command...
  local label="$1"; shift
  if "$@"; then echo "ok    $label"; passed=$((passed + 1)); else echo "FAIL  $label"; failed=$((failed + 1)); fi
}
skip() { echo "skip  $1"; skipped=$((skipped + 1)); }

json_ok() { for f in "$@"; do node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$f" || { echo "    bad JSON: $f"; return 1; }; done; }
step "JSON files parse" json_ok .claude-plugin/plugin.json .claude-plugin/marketplace.json hooks/hooks.json \
  project-layer/settings.json project-layer/settings-auto.json project-layer/legacy-offered-rules.json skills/e2e/templates/package.json \
  skills/e2e/templates/tsconfig.json
step "front matter of skills, agents, rules" node tests/check-frontmatter.mjs
step "rule paths load for the right files" node tests/check-globs.mjs
step "hooks: secret guard, session context, setup modes" bash tests/check-hooks.sh
step "secret guard: credential formats, placeholders, every write path" node tests/check-guard.mjs
step "git guard: force-pushes and skipped hooks in every form" bash tests/check-git-guard.sh
step "plugin-build templates: hook tests, run.sh layouts, eval keys, sample plugin" bash tests/check-plugin-template.sh
step "kit.mjs: detect, install, sync, add/remove-app, adopt, uninstall, doctor" node tests/check-kit.mjs
inventory_ok() {
  node scripts/css-inventory.mjs tests/fixtures/template --json | node -e '
    const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const has = (k, v) => r[k].some((x) => x.value === v);
    const idAsColor = r.colors.some((x) => /^#(CAFE|CCAAFFEE)$/i.test(x.value));
    if (!(has("colors", "#1F4FD8") && has("breakpoints", "768px") && has("breakpoints", "1024px") && has("fontSizes", "16px") && !idAsColor && r.externalResources.some((x) => /no SRI/.test(x.value)))) { console.error(JSON.stringify(r)); process.exit(1); }'
}
step "css-inventory.mjs on the fixture theme" inventory_ok

# macOS runs hooks with its /bin/bash 3.2 unless a newer bash comes first in PATH, so the hook suites run under it
# too. Elsewhere, point OLD_BASH at a bash 3.2 build to run them.
old_bash="${OLD_BASH:-/bin/bash}"
if [ -x "$old_bash" ] && "$old_bash" -c '[ "${BASH_VERSINFO[0]}" -lt 4 ]' 2>/dev/null; then
  old_bash_ok() {
    local d status; d="$(mktemp -d)"; ln -s "$old_bash" "$d/bash"
    PATH="$d:$PATH" "$old_bash" tests/check-hooks.sh && PATH="$d:$PATH" node tests/check-guard.mjs &&
      PATH="$d:$PATH" "$old_bash" tests/check-git-guard.sh && PATH="$d:$PATH" "$old_bash" tests/check-plugin-template.sh
    status=$?; rm -rf "$d"; return "$status"
  }
  step "hooks and plugin templates under bash $("$old_bash" -c 'echo "$BASH_VERSION"')" old_bash_ok
else
  skip "hooks under bash 3.2 (runs on macOS, or with OLD_BASH set to a bash 3.2 binary)"
fi

if command -v shellcheck >/dev/null 2>&1; then
  step "shell scripts pass shellcheck" shellcheck -S warning scripts/*.sh tests/*.sh skills/plugin-build/templates/*.sh \
    skills/plugin-build/templates/hooks/*.sh
else
  skip "shellcheck (install it to lint the shell scripts)"
fi

if python3 -c "import PIL" 2>/dev/null; then
  step "palette.py and ui_compare.py" python3 tests/check-images.py
else
  skip "palette.py and ui_compare.py (install Pillow to run)"
fi

if [ "${SKIP_NETWORK:-0}" != "1" ] && command -v npx >/dev/null 2>&1; then
  design_ok() {
    npx -y @google/design.md@0.4.0 lint project-layer/templates/design.md | node -e '
      const r = JSON.parse(require("fs").readFileSync(0, "utf8"));
      if (r.summary.errors || r.summary.warnings) { console.error(JSON.stringify(r.findings)); process.exit(1); }'
  }
  step "DESIGN.md starter lints clean" design_ok
else
  skip "DESIGN.md lint (network or npx unavailable)"
fi

if command -v claude >/dev/null 2>&1; then
  validate_ok() { for t in .claude-plugin/plugin.json .claude-plugin/marketplace.json skills agents; do claude plugin validate --strict "$t" >/dev/null || { echo "    claude plugin validate failed for $t"; return 1; }; done; }
  step "claude plugin validate --strict" validate_ok
else
  skip "claude plugin validate (Claude Code not installed)"
fi

if grep -rqn CHANGE-ME .claude-plugin README.md; then
  echo "note  CHANGE-ME placeholders remain in .claude-plugin/ and README.md; set your GitHub owner before publishing"
fi
echo "passed $passed, failed $failed, skipped $skipped"
[ "$failed" -eq 0 ]
