---
paths:
  - "{{APP}}/.claude-plugin/**/*"
  - "{{APP}}/**/SKILL.md"
  - "{{APP}}/{skills,.claude/skills}/**/*"
  - "{{APP}}/{agents,commands,.claude/agents}/**/*.md"
  - "{{APP}}/hooks/**/*"
  - "{{APP}}/scripts/**/*"
  - "{{APP}}/.mcp.json"
  - "{{APP}}/evals/**/*"
kit: {"name": "Claude Code skills, agents, hooks, and plugins", "commands": {"dev": "claude --plugin-dir .", "test": "bash tests/run.sh", "testOne": "claude plugin eval . --case \"<name>\" --ablation none", "lint": "claude plugin validate --strict .claude-plugin/plugin.json"}}
---

# Stack: Claude Code skills, agents, hooks, and plugins

- Check `claude --version` and its docs (code.claude.com/docs) before using any field, event, or flag; never write
  one from memory. `/project-kit:plugin-build` is the procedure; an MCP server also uses the `mcp` stack.
- Pick the block: a skill for a procedure, a subagent for work in its own context, a hook for what must happen
  every time, an MCP server for live data or actions, a plugin to share them; for one repo, `.claude/` holds them.

## Skills
- `description` says what the skill does and when to use it, key use case first, in the words users type. Together
  with `when_to_use` it's cut at 1,536 characters, and all skill listings share about 1% of the context window.
- `disable-model-invocation: true` for workflows with side effects (deploy, release, bulk changes);
  `user-invocable: false` for background knowledge only Claude should load.
- Keep SKILL.md under 500 lines; move detail into reference files it links, and repeatable work into scripts.
  Refer to files with `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, never a path on your machine.
- `allowed-tools` grants exact command patterns (`Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs" *)`), never
  bare `Bash`. `` !`command` `` runs before Claude reads the skill: read-only, fast, and a failure aborts the skill.
- A skill meant for claude.ai too keeps its front matter to `name`, `description`, `license`, `compatibility`,
  `metadata`, and `allowed-tools` (upload rejects other keys) and skips `` !`command` `` and `${…}` variables.

## Subagents
- `description` says when to delegate; the body is the system prompt. List `tools` explicitly; reviewers get
  read-only tools plus `disallowedTools: Write, Edit, NotebookEdit`.
- Plugin agents ignore `hooks`, `mcpServers`, and `permissionMode`; don't rely on them.

## Hooks
- Choose the event deliberately. A matcher made only of letters, digits, `_`, `-`, spaces, `,`, and `|` lists exact
  names; anything else is an unanchored regex (`Edit.*` also matches `NotebookEdit`). List every tool you mean.
- Read the event JSON from stdin with a parser and a fallback; decide and test what happens when parsing fails.
  `PreToolUse` exit 2 blocks the call and shows stderr to Claude; exit 0 allows it.
- Keep hooks fast (SessionStart runs on every start) and output short (context from a hook is capped at 10,000
  characters). Quote `"${CLAUDE_PLUGIN_ROOT}"` in shell-form commands, or use the exec form with `args`.
- Bash hooks must work in macOS's bash 3.2 (no heredoc inside `$(...)`, `mapfile`, or `declare -A`) and in Git Bash;
  without Git Bash, Windows runs hooks in PowerShell, they can't start, and the call goes ahead, so say it's required.
  Ship `.gitattributes` with `* text=auto eol=lf`, use POSIX tools, and don't assume jq or python3.
- Hooks run with the user's permissions: treat tool input as untrusted data, never `eval` it, and add no network
  calls a hook doesn't need.

## Plugins and marketplaces
- `.claude-plugin/plugin.json`: kebab-case `name`, SemVer `version` (it pins users until you bump it),
  `description`, `author`, `homepage`, `repository`, `license`. Component folders sit at the plugin root.
- Settings users choose go in `userConfig` (secrets with `sensitive: true`); hooks read them as
  `CLAUDE_PLUGIN_OPTION_<KEY>`. `options` stops the plugin loading before Claude Code 2.1.271.
- State goes in `${CLAUDE_PLUGIN_DATA}`; `${CLAUDE_PLUGIN_ROOT}` changes on every update. A `CLAUDE.md` at the
  plugin root never loads; a `bin/` folder stops installs on claude.ai and Cowork.
- In `marketplace.json`, `source` is a `./` path from the marketplace root, a bare name under `metadata.pluginRoot`,
  or a source object (github, url, git-subdir, npm, archive, command); keep `name` and `version` equal to plugin.json.

## Testing and release
- Run `claude plugin validate --strict` on each `plugin.json` path (which also checks its skills and agents) and
  on the marketplace, CLI pinned in CI. On a folder holding both manifests, validate checks only the marketplace.
- Hook tests feed recorded event JSON to each script: allowed and blocked cases, a broken parser, Windows-style input.
- Evals (`evals/<case>/prompt.md` plus `graders/*.md`): per skill, one prompt that must trigger it and one that
  must not, each with a `tool_used: Skill` grader set to `arm: both` (a two-arm run doesn't score it otherwise).
  They use your credentials: run them before a release, or in CI with `--trust-plugin` and `--max-cost-usd`.
- Release: bump the version, add a CHANGELOG entry, and commit; then `claude plugin tag --push` tags
  `<name>--v<version>` (it refuses a dirty tree, or a manifest and marketplace entry that disagree).
