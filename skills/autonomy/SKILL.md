---
name: autonomy
description: Show or change this project's autonomy mode. guarded (default) asks before destructive commands and risky changes; auto is for unattended development such as claude --dangerously-skip-permissions, where it removes the kit's ask rules (they prompt in every permission mode) and tells Claude to decide and record instead of asking.
disable-model-invocation: true
argument-hint: "[guarded|auto]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:autonomy $ARGUMENTS

With no argument, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" autonomy` and report the mode. Otherwise:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" autonomy <guarded|auto> --dry-run` and show what would change,
   then run it without `--dry-run`. It records the mode in `.claude/project-kit.json`, swaps the kit's own
   permission rules in `.claude/settings.json`, and syncs so CLAUDE.md §11 is present.
2. Tell the user what the mode means for this project:
   - `auto`: the kit's ask rules are gone, so local destructive commands (`rm -rf`, `migrate:fresh`,
     `git reset --hard`, `compose down -v`, `git push`) follow the session's permission mode. Commands that print
     secrets, `terraform apply` and `destroy`, and `kubectl delete` are denied outright, and the deny rules for
     secret files, force-pushes, and skipped hooks stay, as do the secret guard and git guard hooks. Claude stops
     asking for approvals and records its decisions in the task file; production, deploys, pushing, and secrets
     still wait for the user (CLAUDE.md §11).
   - `guarded`: the ask rules are back, and Claude asks before the changes CLAUDE.md §5 lists.
3. If the command reports ask rules of the user's own that remain, list them: they prompt even under
   `--dangerously-skip-permissions`, and only the user can decide to remove them. The same goes for ask rules in
   `.claude/settings.local.json` and `~/.claude/settings.json`.
4. The mode is committed with the project, so it applies to everyone who works in the repo. Use `auto` on
   development machines, containers, or worktrees where nothing in reach is production; recommend Claude Code's
   sandbox with it. Commit `chore(kit): autonomy <mode>` on a branch.
