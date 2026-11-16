---
name: task
description: The daily work loop in a project-kit project. Use when picking, creating, starting, parking, blocking, or finishing a task, hotfix, phase, or ADR; when asked what to work on next or for the state of the work; and to run independent tasks in parallel worktrees. Keeps ids, task files, STATUS.md, and log.md consistent through kit.mjs.
argument-hint: "[next | new <title> | start <id> | done <id> | board]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:task $ARGUMENTS

Every bookkeeping step runs through `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" <command>` (shortened to `kit`
below). It picks global ids across branches, fills templates, keeps the phase table, STATUS.md lines (Updated,
Active task, Branch, Queue), and log.md in step, and refuses inconsistent moves. Don't edit those by hand.

## Pick
- `kit next`: the next ready task (status `todo`, every dependency `done`; hotfixes first). `kit board` shows all
  tasks by status, with blocked reasons. Read only the task file it names.
- Nothing ready: say what blocks the queue and what the user can unblock.

## Create (planning, on main)
- `kit new phase --title "…"`, then fill its Goal, Scope, Contract, and Demo.
- `kit new task --title "…" --app <app> [--phase phase-NN] [--type feat|fix|refactor|test|docs|chore]
  [--security] [--ui] [--depends task-001,task-002]`, then fill Context, Acceptance Criteria (Given/When/Then),
  Test Plan (negative rows for anything security-sensitive), and Plan. The first task of a phase is the thin
  slice (CLAUDE.md §2).
- `kit new hotfix --title "…" --app <app>` for a bug in shipped behavior; `kit new adr --title "…"` for a decision.
- Commit the planning files (`docs(<phase>): plan …`) before starting tasks, so their branches see them.

## Do
1. `kit start <id>`: creates or switches to branch `<id>-<slug>` and marks the task `in-progress`. It refuses a
   dirty tree; commit or park first. A dependency still open: start from that task's branch instead of main.
2. Build loop and Definition of Done (CLAUDE.md §4 and §5) at the project's rigor.
3. Close: write the Result (checks run, evidence per criterion, decisions), then `kit set <id> in-review` when it
   needs the user's approval (`approval_required: true`), otherwise `kit set <id> done`. Commit
   `<type>(<id>): <summary>`.
- Blocked: `kit set <id> blocked --reason "…"`, a `wip(<id>): …` commit, then `kit next`.
- Parking unfinished work: write the next step in the task's Result, commit `wip(<id>): …`, leave it `in-progress`.

## Parallel tasks
`kit next --parallel` lists every ready task and warns when two touch the same app. To run them at once, give
each one its own subagent in its own git worktree (the Agent tool's worktree isolation, or `git worktree add
.worktrees/<id> -b <id>-<slug>`), with the task file path and this skill's Do steps. Worktrees never edit
STATUS.md; the main checkout updates it when it merges their branches, in dependency order. Keep it to a few at a
time, and run tasks on the same app one after another.

## Companions, when installed
superpowers `writing-plans` (writes the phase and task files; then use `kit new` ids), `test-driven-development`,
`systematic-debugging`, `verification-before-completion`; ponytail for minimal code; the stack's skill
(`timedoor-laravel:laravel-standards` for Laravel) for conventions; Context7 for current library docs;
token-router for model routing. If one is missing, apply its principle by hand.
