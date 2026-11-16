# project-kit

A Claude Code plugin that gives every project, on any stack, the same production-grade way of working:
resumable task tracking, test-first builds proven by real end-to-end tests, design-to-UI fidelity, security
gates, and versioned releases. It works on its own and gets stronger with superpowers, impeccable, ponytail,
token-router, timedoor-laravel, and Google's DESIGN.md.

## Why a plugin plus a thin project layer
Claude Code plugins can ship skills, agents, hooks, and MCP servers, but not project instructions: a plugin's
CLAUDE.md is never loaded, path-scoped rules only load from a project's `.claude/rules/`, and plugin settings can't
set permission rules. So project-kit has two halves:

| Lives in the plugin (updates from its marketplace) | Written into each project (owned by the project) |
|---|---|
| 15 skills, 4 reviewer agents, 4 hooks, helper scripts, the rules and templates library | CLAUDE.md (a project profile block plus a kit-managed core block), `.claude/rules/kit/` for the stacks you use, `.claude/templates/`, permission rules in `.claude/settings.json`, tracking folders |

`/project-kit:sync` updates the kit-managed files in a project to the installed plugin version and never
overwrites anything you edited locally.

## Install
```text
/plugin marketplace add soumabali/project-kit
/plugin install project-kit@project-kit
```
Recommended companions (the kit tells you which ones fit a project):
```text
/plugin install superpowers@claude-plugins-official
/plugin marketplace add DietrichGebert/ponytail      then /plugin install ponytail@ponytail
/plugin marketplace add soumabali/token-router       then /plugin install token-router@td-router
/plugin marketplace add pbakaus/impeccable           then /plugin install impeccable@impeccable
/plugin marketplace add backend-timedoor/timedoor-laravel   then /plugin install timedoor-laravel@timedoor-laravel-marketplace
```
Command-line tools used through npx, so nothing to install: `@google/design.md` (DESIGN.md lint and export) and
`@modelcontextprotocol/inspector` (MCP contract tests). Install gitleaks on each machine and in CI for secret scanning.

## Start
In a new or existing repo, run `/project-kit:kickoff`. It inspects the repo, asks one batch of questions, installs
the project layer, and runs Phase 00: tooling, security baseline, local environment, real tests, CI, and docs.

## Setup on session start
When you enable the plugin, Claude Code asks for its `setup` option; change it any time in `/config`. It decides
what happens when a session starts at the root of a git repository that doesn't have the project layer yet:

| `setup` | What happens |
|---|---|
| `ask` (default) | Claude mentions once that `/project-kit:kickoff` sets the repo up. If you decline, it records the repo and doesn't offer again. |
| `auto` | Before Claude's first reply, the session hook installs the project layer with the apps it detects, and Claude tells you it did. CLAUDE.md loads by itself from the next session; Claude reads it straight away in this one. |
| `off` | Nothing happens until you run `/project-kit:kickoff`. |

- Automatic setup writes the files; `/project-kit:kickoff` is still the step that confirms the apps, fills in the
  project profile, and runs Phase 00.
- Setup never runs in your home folder, in a subfolder or linked worktree of a repository, or in CI (`CI` set).
  `auto` never edits an existing CLAUDE.md; in such a repo it falls back to `ask`.
- To undo an automatic setup, tell Claude: the session notice gives it the exact `kit.mjs uninstall` command, which
  deletes only files nobody has edited, restores `.gitignore` and `.claude/settings.json`, and stops setup in that
  repo from then on.
- The option is per user: it lives under `pluginConfigs` in `~/.claude/settings.json`
  (`"project-kit@project-kit": {"options": {"setup": "auto"}}`), so it applies to every repo where the plugin is
  enabled. An organization can set it for everyone through managed settings.
- Detection reads stack markers (`artisan`, `composer.json`, `go.mod`, `Cargo.toml`, `pubspec.yaml`, `*.csproj`, `pom.xml`,
  `package.json` dependencies, `pyproject.toml`, MCP SDK dependencies, Claude Code plugin manifests and `SKILL.md`
  files, and more) at the root, in `07-application/*`, `apps/*`, `services/*`, `packages/*`, and `plugins/*`, at
  each path a root `marketplace.json` lists, and in folders such as `frontend/`, `backend/`, and `mobile/`. Check
  what it finds with `node <plugin>/scripts/kit.mjs detect`; fix the list with `add-app` and `remove-app`.

## Skills
| Command | What it does |
|---|---|
| `/project-kit:kickoff` | New project or adopt an existing repo; installs the project layer; runs Phase 00 at the chosen rigor |
| `/project-kit:task` | The daily loop: next ready task, new task/hotfix/phase/ADR, start (branch + status), block, finish, board, parallel worktrees |
| `/project-kit:prototype` | Clickable HTML prototype of a feature's flows from the PRD and DESIGN.md, reviewed before any code |
| `/project-kit:design-intake` | DESIGN.md, HTML template, JPG/PNG mockups, Figma, brand guide, or live site → linted DESIGN.md, exported tokens, screen inventory; with no design yet, three rendered directions to pick from |
| `/project-kit:ui-verify` | Screenshots at every breakpoint vs the reference, side-by-side diffs, independent UI review with a design-quality critique, axe, visual baselines |
| `/project-kit:e2e` | Real tests: Playwright E2E for any web stack, API black-box tests, Flutter integration_test/Patrol/Maestro, real-database integration tests |
| `/project-kit:mcp-build` | MCP servers and clients on the current spec with an official SDK, auth, and Inspector CLI tests |
| `/project-kit:plugin-build` | Claude Code skills, subagents, hooks, plugins, and marketplaces: the right building block, strict validation, hook tests, must-trigger and must-not-trigger evals, release tags |
| `/project-kit:security-gate` | Threat sketch, checklist with evidence, scanners, independent security review |
| `/project-kit:release` | Verify, version, tag, staging then production with approval, smoke test, record |
| `/project-kit:add-stack` | Add an app, or rules for a stack the kit doesn't cover yet |
| `/project-kit:sync` | Update kit-managed files to the installed version, protecting local edits |
| `/project-kit:rigor` | Show or set how much process the project carries: `prototype`, `standard`, or `production` |
| `/project-kit:autonomy` | Show or set the project's default autonomy: `guarded` (asks first) or `auto` (unattended, no prompts) |
| `/project-kit:doctor` | Health check: drift, missing files, unverified commands, tracked secrets, leftover ask rules, an unchosen DESIGN.md, missing companions |

Claude starts `task`, `prototype`, `design-intake`, `ui-verify`, `e2e`, `mcp-build`, `plugin-build`,
`security-gate`, `add-stack`, and `doctor` on its own when the work calls for them, which matters in unattended
runs. `kickoff`, `sync`, `release`, `rigor`, and `autonomy` change the project's setup or ship it, so only you
start them.

Agents: `project-kit:code-reviewer` (every task's diff; sonnet, or opus at production rigor), `project-kit:test-reviewer`, `project-kit:security-reviewer`, and `project-kit:ui-reviewer`
(fidelity and a design-quality critique, on opus). All four are read-only and review work they didn't write.

## Stacks
Laravel · PHP (Symfony, WordPress, plain) · Ruby on Rails · C#/.NET · Go · Rust · Flutter · Java/Kotlin Spring Boot ·
Python (Django, FastAPI, Flask) · HTML/CSS · Nuxt · Next.js · Vite single-page apps (React, Vue, Svelte) · React
Native (Expo) · Node.js/TypeScript services · MCP (combined with a
language stack, for example `node-typescript+mcp`) · Claude Code skills, agents, hooks, and plugins (with a
language stack and `mcp` when a plugin ships code or an MCP server) · Playwright E2E suite. Each stack's rules load only when Claude
reads that app's files, so a Laravel API and a Flutter app in one repo each get their own guidance.
`/project-kit:add-stack` creates rules for anything else from the framework's official docs.

## What a project gets
```
CLAUDE.md                         profile (yours) + core rules (kit-managed)
.claude/project-kit.json          manifest used by sync
.claude/settings.json             deny reads of .env, key, and credential files; block force-pushes and skipped hooks
.claude/rules/kit/                security, testing, database, api, ui-ux, design-quality, infra, stack-<x> (path-scoped)
.claude/rules/project/            your own rules; sync never touches them
.claude/templates/                task, phase, PRD, ADR, STATUS, log, DESIGN.md starter, screens, runbook, changelog
.gitignore, .gitattributes        secret and report files ignored; log.md and CHANGELOG.md merge by union, so branches never conflict on them
01-ideas/ 02-prd/ 03-phases/ 04-tasks/ 05-progress/ 06-technical-docs/ (glossary.md included) 07-application/<app>/
```
01 to 04 are the planning steps, in order: ideas and client inputs, PRDs, phases (each starting from an agreed
contract: data model, API, screens, decisions), and tasks. 05 to 07 are kept current throughout: progress, reference
docs, and code.
Every session starts with a hook printing the project's rigor, the session's autonomy, `05-progress/STATUS.md`, and
`git status`, so work resumes from files rather than memory. It also says when the project is on an older kit version.

## Rigor
Not every project needs every gate. Kickoff asks, and `/project-kit:rigor` changes it later:

| | prototype | standard (default) | production |
|---|---|---|---|
| For | demos, tender prototypes, spikes, internal tools | most client work | long-lived or regulated systems |
| Tests | unit tests for logic, one E2E smoke per critical journey | test first, real-database integration, E2E per critical journey | plus coverage floor, visual baselines, k6 before releases |
| Reviews | security-sensitive work only | code reviewer per task | plus test reviewer, reviewers on opus |
| Phase 00 | apps, local env, secret scan and `.env.example`, one smoke journey, a small CI (lint, tests, secret scan), README | full CI, security baseline, reference slice, docs | plus every optional scanner you accept |

Security rules apply at every level. Projects installed before 1.5.0 read as `production` until you change them.

## Daily loop
`/project-kit:task` (and Claude, on its own) runs the bookkeeping through `kit.mjs`, so ids, task files, STATUS.md,
and log.md stay consistent without Claude hand-editing them: `next` picks the next ready task (dependencies done,
hotfixes first), `new task|hotfix|phase|adr` creates one from the template with a global id, `start <id>` branches
and marks it in progress, `set <id> <status>` moves it (blocked needs a reason), `board` shows everything, `log "<text>"` adds a log line
that belongs to no status change, and
`next --parallel` lists tasks that can run at once in separate worktrees.

Features with UI go idea → PRD → clickable prototype (`/project-kit:prototype`) → phase contract → tasks, and a
phase's first task is a thin slice of the main journey shown to you before the rest is built. Every task's Result
carries evidence you can check without running anything (screenshots, recordings, command output).

## Fewer bugs, better results
- **Quick check after every edit.** A PostToolUse hook runs the app's fast check on just the edited file (`php -l`,
  ESLint, `gofmt -e`, `ruff`, `dart analyze`, …) and shows Claude any failure at once. `kit.mjs check` lists them and
  sets your own (`--cmd "…{file}…" --ext php`, `--off`). A missing tool is skipped. A command you set is saved in
  `.claude/project-kit.json`, so it travels with the repo; on every other machine it runs only after someone there
  has read it and approved it with `kit.mjs check <app> --trust` (Claude says once per session when one is waiting).
- **One contract.** Web and mobile apps use types or a client generated from `openapi.yaml`, so a mismatch fails
  the build instead of the user.
- **Current docs.** Claude checks the installed version's docs (Context7 when installed) before using a library
  API the project doesn't use yet.
- **Lessons.** Each hotfix adds one line to `.claude/rules/project/lessons.md`; repeated corrections become project rules.
- **A reference slice** in Phase 00 (standard and production) gives every later feature a pattern to copy, listed
  in `.claude/rules/project/patterns.md`.
- **Starter repositories.** Register your own templates (auth, CI, Docker, components, common modules already done)
  once per machine: `node <plugin>/scripts/kit.mjs starters set laravel https://github.com/you/laravel-starter`.
  Phase 00 clones the starter instead of running the framework generator.
- **The client's words.** `06-technical-docs/glossary.md` holds the client's terms; code, UI copy, and tests use them.

## Design that doesn't look generated
- DESIGN.md starts as an `UNCHOSEN` placeholder that blocks UI work. With no design yet, `/project-kit:design-intake`
  renders three different directions of your most important screen with realistic content, and you pick.
- The design-quality rule lists the generated look to avoid (purple gradients, the template hero with three icon
  cards, cards in cards, emoji icons, generic copy, lorem ipsum) and what to aim for (hierarchy, type contrast,
  density that fits the user, the locale's real content), with patterns for lists, detail pages, dashboards,
  forms, public pages, and mobile apps.
- Each UI app builds on one component base themed from the tokens (shadcn/ui, Nuxt UI, Filament, Material 3, …).
- `/project-kit:ui-verify` adds a design-quality critique to the fidelity review; a screen with the generated look
  fails it.

## Enforced versus advisory
CLAUDE.md and rules guide Claude; settings, hooks, and CI enforce. project-kit enforces what it can: the
SessionStart hook; a secret guard on every write path (file edits, notebooks, and shell commands; it uses gitleaks
when installed); a git guard that blocks force-pushes and skipped hooks in the forms permission rules can't see
(`git -C`, `git --no-pager`, quoted flags, `SKIP=` or `HUSKY=0` prefixes, nested commands; it catches mistakes, not
deliberate evasion); the command guard (below); permission deny rules; and the CI and pre-commit gates Phase 00
installs. Branch protection and secret scanning on the repository are settings only you can turn on. No
instruction file can guarantee zero bugs or vulnerabilities; this kit makes them hard to introduce and fast to
catch. `Read` deny rules don't stop a script that opens files itself; enable Claude Code's sandbox for OS-level
isolation. The hooks are Node.js scripts (Node 20 or later, which the kit needs anyway), so they run the same on
macOS, Linux, and Windows, with or without Git Bash.

## Unattended development (autonomy)
In a project-kit project, the command guard hook decides about destructive commands per session, so you can run
unattended without changing anything the team shares. A session's autonomy is, first match wins:
`PROJECT_KIT_AUTONOMY=auto|guarded` in the environment that starts Claude Code; `auto` when the session runs with
`--dangerously-skip-permissions` (or is switched to bypass mode); otherwise the project default from
`/project-kit:autonomy` (`guarded` unless set). Claude is told the session's mode at the start and again whenever it
changes (for example after switching to bypass mode with Shift+Tab).

```text
claude --dangerously-skip-permissions            # auto for this session
PROJECT_KIT_AUTONOMY=auto claude                  # auto, with your normal permission mode
$env:PROJECT_KIT_AUTONOMY="auto"; claude          # the same in PowerShell
```

| | `guarded` (default) | `auto` |
|---|---|---|
| Local destructive commands (`rm -rf`, `find -delete`, `migrate:fresh`, `git reset --hard`, `git restore .`, `compose down -v`), `git push` | ask | run |
| Commands that print secrets, `terraform apply` and `destroy`, `kubectl delete`, package publishing (`npm publish`, `cargo publish`), deploys (`vercel`, `netlify`, `firebase`, `wrangler`, `fly`), `gh pr merge`, `gh release create` | ask | denied |
| Secret files, force-pushes, skipped hooks; the secret guard and git guard | denied | denied |
| Risky changes (CLAUDE.md §5 "Ask first"), unclear requirements, a dirty tree | Claude asks and waits | Claude decides conservatively, records the decision in the task file, and continues |
| Production, deploys, releases, pushing, secrets only you hold | Claude asks | the task is parked as `blocked` and the run moves on |

- Tests, reviews, and security gates are the same in both modes. A finished task stays on its own branch, and
  STATUS.md lists the branches to merge, the decisions to look over, and what is blocked.
- Up to 1.4.0 the kit put these as ask rules in `.claude/settings.json`, which prompt in every permission mode.
  `/project-kit:sync` takes out the ones it added; ask rules you wrote yourself (there, in
  `.claude/settings.local.json`, or in `~/.claude/settings.json`) keep prompting, and `doctor` lists them.
- Use `auto` where nothing in reach is production (a development machine, a container, a worktree), ideally with
  Claude Code's sandbox on.

## Updating
`/plugin` → Installed → project-kit → Update now (or `claude plugin update project-kit@project-kit` in a terminal),
then `/reload-plugins`, then `/project-kit:sync` in each project. Auto-update is off by default for third-party
marketplaces; turn it on under `/plugin` → Marketplaces.

## Project layer commands
Skills call `scripts/kit.mjs` for you; run it directly with `node <plugin>/scripts/kit.mjs <command>`:
`stacks`, `detect`, `install`, `add-app`, `remove-app`, `sync`, `new`, `start`, `set`, `next`, `board`, `log`, `rigor`,
`autonomy`, `check`, `starters`, `doctor`, `uninstall` (removes only what nobody has edited, and gives a merged
CLAUDE.md its own content back), and `skip`. `--help` lists the options.
Each command plans its changes and writes nothing if a check fails. It never overwrites a file it didn't write
(`sync --force` saves the old one as `.orig`), never writes through a symbolic link, and undoes a half-finished run.

## Developing the kit
- `bash tests/run.sh` checks manifests, front matter, rule path matching, hooks (session context and the ask, auto,
  and off setup modes), the secret guard (credential formats, placeholders, every write path), the git guard, the
  command guard per autonomy, the quick check, the installer (detect, install, sync and rule migration, the task
  loop, rigor, autonomy, checks, starters, add-app, remove-app, adopt, uninstall, doctor), helper scripts, DESIGN.md
  lint, and `claude plugin validate --strict`. CI runs it on Linux and macOS, runs the Node suites (guards, quick check, `kit.mjs`) on Windows, and fails a
  release tag that still has an unfilled placeholder owner.
- The Maintenance workflow checks weekly that the versions the kit writes into projects are current
  (`node tests/check-pins.mjs`), and runs the skill trigger evals in `evals/` when started by hand.
- Bump `version` in `.claude-plugin/plugin.json`, add a CHANGELOG entry, then `claude plugin tag --push`.
- Stack rules live in `project-layer/rules/stacks/` with a `kit:` metadata line (display name, default commands, quick check)
  and `{{APP}}` path placeholders; keep each under 70 lines.

## Moving a project from the earlier single-file kit
- `08-tests/<id>.md` specs → the task file's Test Plan; `05-progress/**/<id>-result.md` → the task's Result.
- `progress-log.md` files → `05-progress/log.md`; write a fresh `05-progress/STATUS.md`.
- Remove `notion_page_id`; add the new task fields from `.claude/templates/task.md`; make task numbers global.
- Then run `/project-kit:kickoff`. It merges with your existing CLAUDE.md and keeps the templates already in
  `.claude/templates/`; `kit.mjs sync --dry-run` shows how they differ from the kit's.
