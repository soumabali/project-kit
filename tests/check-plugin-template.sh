#!/usr/bin/env bash
# The plugin-build templates work: the example hook passes its own tests; run.sh validates every manifest in
# single-plugin, marketplace, skills-folder, and standalone-skill layouts and runs the other tests; the evals use only keys
# `claude plugin eval` accepts; and a plugin assembled the way the skill describes passes validation for real
# (when Claude Code is installed).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/skills/plugin-build/templates"
failures=0
problem() { echo "    $1"; failures=$((failures + 1)); }

HOOK="$T/hooks/protect-env.sh" bash "$T/hook-test.sh" || problem "the template hook failed its own tests"

W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
P="$W/plugin"
mkdir -p "$P/.claude-plugin" "$P/skills/release-notes" "$P/agents" "$P/hooks" "$P/tests"
cat > "$P/.claude-plugin/plugin.json" <<'EOF'
{
  "name": "sample-plugin",
  "version": "0.1.0",
  "description": "A sample plugin assembled from the project-kit plugin-build templates.",
  "author": { "name": "Example" },
  "homepage": "https://example.com/sample-plugin",
  "repository": "https://example.com/sample-plugin.git",
  "license": "MIT"
}
EOF
cat > "$P/skills/release-notes/SKILL.md" <<'EOF'
---
name: release-notes
description: Draft release notes from the commits since the last tag. Use when the user asks for release notes, a changelog entry, or a summary of what changed in a release.
---

# Release notes
1. Find the last tag and list the commits since it.
2. Group them as Added, Changed, Fixed, and Security, in plain language.
EOF
cat > "$P/agents/reviewer.md" <<'EOF'
---
name: reviewer
description: Reviews a change it didn't write and reports problems by severity. Use after a task's code is written.
tools: Read, Grep, Glob
disallowedTools: Write, Edit, NotebookEdit
---

Review the diff you are given. Report each problem with file, line, and a suggested fix.
EOF
cat > "$P/hooks/hooks.json" <<'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/protect-env.sh\"" }]
      }
    ]
  }
}
EOF
cp "$T/hooks/protect-env.sh" "$P/hooks/"
cp "$T/hook-test.sh" "$T/run.sh" "$P/tests/"
cp -R "$T/evals" "$P/evals"
cp "$T/gitattributes" "$P/.gitattributes"
bash "$P/tests/hook-test.sh" || problem "hook-test.sh copied into a plugin doesn't find or pass its hook"

# The eval templates use only the keys `claude plugin eval` accepts (code.claude.com/docs/en/plugin-evals, "Eval
# suite reference"), where an unknown key is an error, and every Skill grader counts in the default two-arm run.
eval_keys_ok() { # eval dir
  node - "$1" <<'EOF'
const fs = require('fs'), path = require('path');
const CASE = ['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model',
  'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env'];
const OPTIONS = { regex: ['pattern', 'flags', 'match', 'target'], tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'], file_exists: ['path', 'exists'], llm: ['criteria', 'focus'],
  baseline: ['baseline_file', 'criteria'] };
const root = process.argv[2], bad = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
function frontMatter(file, rel) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) { bad.push(`${rel}: no front matter`); return null; }
  const keys = {};
  let last = null;
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (k) { last = k[1]; keys[last] = k[2].trim().replace(/^(['"])(.*)\1$/, '$2'); continue; }
    const e = last === 'env' && line.match(/^\s+([^\s:#][^:]*):/);
    if (e && !/^EVAL_[A-Z0-9_]*$/.test(e[1].trim())) bad.push(`${rel}: env key "${e[1].trim()}" must match EVAL_[A-Z0-9_]*`);
  }
  return keys;
}
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  if (path.basename(file) === 'prompt.md') {
    const fm = frontMatter(file, rel);
    for (const k of Object.keys(fm || {})) if (!CASE.includes(k)) bad.push(`${rel}: "${k}" isn't a prompt.md key`);
  } else if (path.basename(path.dirname(file)) === 'graders' && file.endsWith('.md')) {
    const fm = frontMatter(file, rel);
    if (!fm) continue;
    const options = OPTIONS[fm.type];
    if (!options) { bad.push(`${rel}: grader type "${fm.type}" isn't one of ${Object.keys(OPTIONS).join(', ')}`); continue; }
    for (const k of Object.keys(fm)) if (!['type', 'weight', 'arm', ...options].includes(k)) bad.push(`${rel}: "${k}" isn't a ${fm.type} grader key`);
    if ('arm' in fm && !['with-only', 'both'].includes(fm.arm)) bad.push(`${rel}: arm must be with-only or both`);
    if (fm.type === 'tool_used' && fm.tool === 'Skill' && fm.arm !== 'both') bad.push(`${rel}: a Skill grader needs arm: both, or a two-arm run leaves it out of the score`);
  }
}
if (bad.length) { console.error(bad.map(b => `    ${b}`).join('\n')); process.exit(1); }
EOF
}
eval_keys_ok "$T/evals" || problem "the eval templates use keys or settings claude plugin eval doesn't accept"
mkdir -p "$W/bad-evals/case/graders"
printf -- '---\nmax_turn: 5\nenv:\n  TOKEN: x\n---\nHi\n' > "$W/bad-evals/case/prompt.md"
printf -- '---\ntype: tool_used\ntool: Skill\n---\n' > "$W/bad-evals/case/graders/fired.md"
printf -- '---\ntype: regex\ncriteria: x\n---\n' > "$W/bad-evals/case/graders/text.md"
[ "$(eval_keys_ok "$W/bad-evals" 2>&1 | grep -c .)" -eq 4 ] || problem "the eval key check missed a bad key, env name, or Skill grader"

# run.sh, run with a stand-in claude that records each target it validates and fails the one in CLAUDE_STUB_FAIL.
mkdir -p "$W/bin"
printf '#!/usr/bin/env bash\necho "$4" >> "$CLAUDE_STUB_LOG"\n[ "$4" != "${CLAUDE_STUB_FAIL:-}" ]\n' > "$W/bin/claude"
chmod +x "$W/bin/claude"
stub_run() { # dir, expected validate targets, expected exit (0 or 1)
  : > "$W/log"
  CLAUDE_STUB_LOG="$W/log" PATH="$W/bin:$PATH" bash "$1/tests/run.sh" > "$W/out" 2>&1
  local status=$? got
  got="$(LC_ALL=C sort "$W/log" | tr '\n' ' ')"
  [ "$got" = "$2 " ] || problem "run.sh in ${1#"$W"/} validated '$got', wanted '$2 '"
  [ "$((status != 0))" -eq "$3" ] || { problem "run.sh in ${1#"$W"/} exited $status"; sed 's/^/      /' "$W/out"; }
}
stub_run "$P" ./.claude-plugin/plugin.json 0
grep -q '^ok    tests/hook-test.sh$' "$W/out" || problem "run.sh didn't run the plugin's hook tests"

M="$W/market"
mkdir -p "$M/.claude-plugin" "$M/tests"
for p in plugins/one tools/two node_modules/dep; do mkdir -p "$M/$p/.claude-plugin" && echo '{}' > "$M/$p/.claude-plugin/plugin.json"; done
echo '{}' > "$M/.claude-plugin/marketplace.json"
cp "$T/run.sh" "$M/tests/"
stub_run "$M" "./.claude-plugin/marketplace.json ./plugins/one/.claude-plugin/plugin.json ./tools/two/.claude-plugin/plugin.json" 0
CLAUDE_STUB_FAIL=./tools/two/.claude-plugin/plugin.json stub_run "$M" "./.claude-plugin/marketplace.json ./plugins/one/.claude-plugin/plugin.json ./tools/two/.claude-plugin/plugin.json" 1

S="$W/skills-only"
mkdir -p "$S/skills/notes" "$S/tests"
cp "$T/run.sh" "$S/tests/"
printf 'exit 1\n' > "$S/tests/fails.sh"
stub_run "$S" . 1
grep -q '^FAIL  tests/fails.sh$' "$W/out" || problem "run.sh didn't report a failing test script"

A="$W/standalone" # one skill at the repo root, which `claude plugin validate .` can't check
mkdir -p "$A/tests"
printf -- '---\nname: notes\ndescription: Take meeting notes. Use when the user asks for notes or minutes.\n---\n\n# Notes\n' > "$A/SKILL.md"
cp "$T/run.sh" "$A/tests/"
: > "$W/log"
CLAUDE_STUB_LOG="$W/log" PATH="$W/bin:$PATH" bash "$A/tests/run.sh" > "$W/out" 2>&1 || problem "run.sh failed a standalone skill"
case "$(cat "$W/log")" in */skills) ;; *) problem "run.sh validated '$(cat "$W/log")' for a standalone skill" ;; esac
grep -q '^ok    validate SKILL.md$' "$W/out" || problem "run.sh didn't report the standalone SKILL.md"

if command -v claude >/dev/null 2>&1; then
  bash "$P/tests/run.sh" > "$W/out" 2>&1 || { problem "a plugin built from the templates fails tests/run.sh with the real claude"; sed 's/^/      /' "$W/out"; }
  bash "$A/tests/run.sh" > "$W/out" 2>&1 || { problem "a valid standalone skill fails tests/run.sh with the real claude"; sed 's/^/      /' "$W/out"; }
  printf -- '---\nname: notes\n---\n\n# Notes\n' > "$A/SKILL.md"
  bash "$A/tests/run.sh" > "$W/out" 2>&1 && problem "tests/run.sh passed a standalone skill with no description"
fi

[ "$failures" -eq 0 ] || { echo "  $failures plugin template check(s) failed"; exit 1; }
