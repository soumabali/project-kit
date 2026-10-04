---
name: sync
description: Update this project's kit-owned files (CLAUDE.md core block, .claude/rules/kit/, .claude/templates/, permission rules) to the installed project-kit version without overwriting local edits.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:sync

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" sync --dry-run` and show the user what would change.
2. Run it again without `--dry-run`.
3. For every file reported as `skipped` (edited locally): show the user the difference between their version and
   the kit's, then either move their project-specific lines into `.claude/rules/project/` (or outside the CLAUDE.md
   core block) and rerun with `--force`, or keep their version. Never pass `--force` without asking.
4. Read the updated rule files for anything that now contradicts `.claude/rules/project/` or the CLAUDE.md profile,
   and resolve it with the user.
5. Commit `chore(kit): sync project-kit to v<version>` on a branch and ask before pushing.
