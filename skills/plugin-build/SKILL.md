---
name: plugin-build
description: Design, build, test, and release Claude Code skills, subagents, hooks, and plugins, and the marketplaces that publish them. Use when a project creates or changes a SKILL.md, an agent, a hook, a plugin manifest, or a plugin's evals.
argument-hint: "[skill|agent|hook|plugin|marketplace] [name]"
---

# /project-kit:plugin-build $ARGUMENTS

The app's rules are the `claude-code` stack plus any language stack; this skill is the procedure. Starter files
are in `${CLAUDE_PLUGIN_ROOT}/skills/plugin-build/templates/`. Check `claude --version` and the docs for that
version before relying on any field, event, or flag.

## 1. Decide, and record it in the task file (an ADR for a new plugin)
| Need | Build |
|---|---|
| Instructions or a procedure Claude follows when asked or when relevant | Skill |
| Focused work in its own context with limited tools (a reviewer, a researcher) | Subagent |
| Something that must happen every time, enforced rather than suggested | Hook |
| Live data or actions in another system | MCP server, with `/project-kit:mcp-build` |
| Sharing any of these across repos or people | Plugin, published through a marketplace |
For one repo, use `.claude/skills/` and `.claude/agents/`; for many, a plugin.

## 2. Write it
- Skills: write the `description` first, from the requests users actually type (collect five that should trigger
  it and five near-misses that shouldn't). Keep SKILL.md a short procedure; put reference material in files it
  links and deterministic steps in scripts. Set `disable-model-invocation: true` for anything with side effects.
- Subagents: a one-line `description` of when to delegate, an explicit `tools` list, and a body that says what to
  return. Reviewers are read-only.
- Hooks: start from `templates/hooks/protect-env.sh`: parse stdin with jq, then python3, then a POSIX fallback;
  exit 2 with a message on stderr to block; stay fast and print little.
- Plugins: copy `templates/gitattributes` to `.gitattributes` and `templates/run.sh` to `tests/run.sh`, add
  `evals/results/` to `.gitignore`, and keep each marketplace entry's `name` and `version` equal to its
  `plugin.json`. Hooks are bash, so the README says Windows users need Git Bash (without it, a bash hook can't
  start and the call goes ahead).

## 3. Test
1. `bash tests/run.sh`: it runs `claude plugin validate --strict` on every `plugin.json` path (which also checks
   that plugin's skills and agents) and on the marketplace, then every other `tests/*.sh`; zero warnings. Validating
   a folder that holds both manifests checks only the marketplace, which is why it goes by file path.
2. Hook tests: copy `templates/hook-test.sh` to `tests/` and list allowed and blocked events for every hook. They
   also run with no JSON parser and, on a Mac, under `/bin/bash` 3.2, which Claude Code uses there unless a newer
   bash comes first in PATH (there, a heredoc inside `$(...)` whose body has an unbalanced quote or parenthesis is a
   syntax error, and the hook exits 2 on every call).
3. Evals: copy `templates/evals/` (one case that must trigger the skill and one that must not), or run
   `claude plugin eval init`, then `claude plugin eval .`. Each case runs three times against a no-plugin baseline,
   and its score must reach the threshold (1.0 by default). A `tool_used: Skill` grader counts toward that score
   only with `arm: both`, as in the templates. For iterating on one skill's description,
   `skill-creator@claude-plugins-official` tunes it against should-trigger and should-not-trigger prompts.
4. Try it for real: `claude --plugin-dir <plugin dir>`, run each skill, agent, and hook once, and check
   `claude --plugin-dir <plugin dir> plugin details <name>` for what the plugin adds to every session.
5. CI: copy `templates/ci.yml` to `.github/workflows/`. It installs the Claude Code version in
   `CLAUDE_CODE_VERSION` and runs `tests/run.sh` on every pull request and push to main; evals run only when
   started by hand, with pinned models and a cost ceiling, because they use your credentials.

## 4. Release
Bump `version` in plugin.json (and in the marketplace entry, if it sets one), add a CHANGELOG entry, run the tests
and evals, and commit. Then `claude plugin tag --push` creates and pushes `<name>--v<version>`; it refuses a dirty tree or a
marketplace entry that disagrees with plugin.json. Third-party marketplaces don't auto-update by default, so the
README tells users how to update (`/plugin` → Installed → Update now, then `/reload-plugins`).

## Done when
`tests/run.sh` passes (strict validation of every manifest, and every hook's allowed and blocked tests), every
model-invoked skill has a passing must-trigger and must-not-trigger eval, and `project-kit:code-reviewer` reviewed
the change.
