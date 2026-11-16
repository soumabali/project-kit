---
name: autonomy
description: Show or change this project's default autonomy. guarded (default) asks before destructive commands and risky changes; auto is for unattended development, where nothing asks and Claude decides and records instead. A single session can override the default with PROJECT_KIT_AUTONOMY, and --dangerously-skip-permissions counts as auto.
disable-model-invocation: true
argument-hint: "[guarded|auto]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:autonomy $ARGUMENTS

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" autonomy $ARGUMENTS` and report the result.
2. Explain how a session's autonomy is decided, first match wins:
   - `PROJECT_KIT_AUTONOMY=auto` or `guarded` in the environment that starts Claude Code (per session; for example
     `PROJECT_KIT_AUTONOMY=auto claude`, or `$env:PROJECT_KIT_AUTONOMY="auto"; claude` in PowerShell);
   - a session started with `--dangerously-skip-permissions` (or switched to bypass mode) is `auto`;
   - otherwise the project default this command sets, which is committed and so shared with everyone in the repo.
3. What each mode does:
   - `guarded`: the kit's command guard asks before destructive commands (`rm -rf`, `migrate:fresh`,
     `git reset --hard`, `compose down -v`, `git push`) and commands that print secrets; Claude asks before the
     changes CLAUDE.md §5 lists.
   - `auto`: those commands run without a prompt, except that commands printing secrets, `terraform apply` and
     `destroy`, `kubectl delete`, package publishing, deploys, and `gh pr merge` are denied. Claude decides instead of asking and records each decision in the
     task file; production, deploys, pushing, and secrets still wait for the user (CLAUDE.md §11).
   - Both: the secret guard, the git guard (force-pushes, skipped hooks), and the deny rules for secret files stay.
4. If the command reports ask rules left in `.claude/settings.json`, they prompt in every mode: run
   `/project-kit:sync` to take out the ones older kit versions added, and tell the user which remaining ones are
   their own. Ask rules in `.claude/settings.local.json` and `~/.claude/settings.json` prompt too.
5. Recommend `auto` only where nothing in reach is production (a development machine, a container, a worktree),
   ideally with Claude Code's sandbox on. Commit `chore(kit): autonomy <mode>` on a branch.
