# Changelog

All notable changes to project-kit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.4.0] - 2026-11-15
### Added
- Autonomy modes for a project. `guarded` (the default) is the behavior so far. `auto` is for unattended
  development, for example `claude --dangerously-skip-permissions`, where ask rules still prompt: the kit's ask
  rules are removed, commands that print secrets or change remote infrastructure are denied instead, and CLAUDE.md
  §11 tells Claude to decide conservatively, record the decision in the task file, and continue instead of asking.
  Production, deploys, pushing, and secrets are parked as blocked tasks. Tests, reviews, and security gates don't
  change. Switch with `/project-kit:autonomy auto|guarded` (`kit.mjs autonomy`), or install with `--autonomy auto`.
  Switching swaps only the rules the kit added, restores them on the way back, and never re-adds a rule the project
  deleted. The session hook announces `auto` mode, and `doctor` reports the mode and any ask rules that still prompt.
- Rust stack: rules for Cargo projects and workspaces (errors, async, sqlx, input validation, testing, clippy,
  `cargo audit`), detection from `Cargo.toml`, MCP detection for the `rmcp` SDK, default commands, and Rust file
  patterns in the API and database core rules.
- `Read(~/.cargo/credentials*)` deny rule (crates.io tokens).

## [1.3.0] - 2026-10-03
### Added
- Claude Code stack for skills, subagents, hooks, plugins, and marketplaces: rules that load when Claude touches
  those files; detection of plugin manifests, `SKILL.md` files, `plugins/*` folders, and every relative-path plugin
  a root marketplace lists (`./` paths and bare names under `metadata.pluginRoot`, with or without a plugin.json),
  each an app with its own rule paths; default commands that fit each layout (a marketplace root validates its
  marketplace file); and a second stack for any code a plugin ships (with `mcp` when it includes an MCP server).
- `/project-kit:plugin-build`: choosing the right building block, writing skills that trigger reliably, safe hooks,
  strict validation, hook tests, must-trigger and must-not-trigger evals with `claude plugin eval`, and release
  tags. Its templates include an example guard hook with tests, eval cases whose skill graders count toward the
  score, `.gitattributes`, a `tests/run.sh` that validates every manifest by file path (a folder holding both
  manifests is checked only as a marketplace) or a standalone skill and runs the other tests, and a CI workflow
  with Claude Code and the eval models pinned.
- skill-creator as a companion for skill evals and description tuning.

### Changed
- Design is a step of its own between the PRD and the phase: a phase's contract (data model, API, screens, and
  decisions) is agreed and committed before its tasks are written. The phase template has a Contract section.
- `01-ideas/` holds client inputs as well as ideas, and the PRD template has a Sources section that cites them.
- CLAUDE.md and the README say that 01 to 04 are planning steps done in order, and 05 to 07 are kept current
  throughout.
- The kit's test scripts pass shellcheck, and `tests/run.sh` runs it when it is installed.

### Fixed
- The secret guard no longer blocks every write on macOS: its pattern list was a heredoc with quote characters
  inside `$(...)`, which the built-in bash 3.2 can't parse, so the hook exited 2. The test suite now runs the hooks
  under bash 3.2 on macOS (or wherever `OLD_BASH` points at one).

## [1.2.0] - 2026-10-03
### Added
- `project-kit:code-reviewer` agent; the Definition of Done now has an agent that didn't write the change review
  every task's diff.
- Core rule `infra` for CI, containers, and infrastructure as code (pinned actions, least privilege, no
  `pull_request_target` checkouts, non-root images, local ports on 127.0.0.1, remote Terraform state).
- `.gitattributes` in projects: `05-progress/log.md` and `CHANGELOG.md` merge by union, so two task branches don't
  conflict on them.
- Laravel apps get Larastan in Phase 00, which the Types command needs.
- Dependency cooldowns and install-script review in the security rule; locale rules in the UI rule; release records
  in `05-progress/releases/`; a Security section in the task template.

### Changed
- Precedence: the project's own rules and profile come first, the kit's process, security, and test gates next,
  and the stack skill decides code conventions only.
- CLAUDE.md says that path rules load when a matching file is read, so Claude reads one before creating a file;
  that task-branch commits are pre-authorized; how to pick the next id across branches; and that settings block
  file tools, not programs that print secrets.
- Tasks split by independently testable outcome instead of a five-file limit that the stack rules couldn't meet.
- Task status lives only in the task file and screen verification in the task's UI verification line; the phase's
  task table and screens.md have no status column, so task branches don't conflict on them. STATUS.md is updated
  only in the main checkout; a worktree records its next step in the task file.
- Default commands: Laravel uses the skeleton's `composer setup`, `dev`, and `test` scripts, and its single-test
  command clears the config cache on any version; Rails setup passes `--skip-server` and its audit refreshes the
  advisory database; Next.js runs `next typegen` before `tsc`; and Flutter builds obfuscated with archived symbols.
- Stack rules: TypeScript pinned to 6.x for typescript-eslint and vue-tsc, Spring Boot 4 test and Jackson changes,
  Go 1.25 `CrossOriginProtection`, .NET 10 `AddValidation()`, MCP Client ID Metadata Documents and `iss` checks,
  Symfony's committed `.env`, and wider path coverage (Inertia pages, models and repositories, Go stores, Django and
  FastAPI views, Go handlers, Rails routes and jbuilder views, CommonJS and `.cts` MCP code); the UI rule no longer
  loads for Flutter state classes.
- The e2e templates use pinned v7 actions, Node 24, `defineConfig`, `typescript@~6.0`, and run visual tests in the
  Playwright image with the sign-in variables. The sign-in setup records no traces.
- The MCP contract check uses `--` after the server command and `--protocol-era auto`.
- Updating instructions now match Claude Code's plugin manager.

### Fixed
- `ui-verify` captures went to `test-results/`, which Playwright empties on every run; they now go to `ui-verify/`,
  and the capture run checks accessibility as documented.
- Signed-in screens could be captured or baselined as the sign-in page; the specs now fail when that happens and
  skip when no session is saved.
- The DESIGN.md diff compared the files in the wrong order.
- `kit.mjs` ignored mistyped options (`uninstall --dryrun` ran a real uninstall); unknown options now stop it.
- `doctor` reported no tracked secrets when `.env.production`, SSH keys, or service-account files were committed.
- `palette.py` read transparent pixels as black, took about a minute on photos, and printed tracebacks;
  `css-inventory` read ID selectors as colors and missed range media queries; `ui_compare.py` now creates the
  output folder.
- Kickoff and the e2e skill told Claude to run `/project-kit:add-stack`, which only the user can start.

### Security
- The secret guard covers every write path (Write, Edit, MultiEdit, NotebookEdit, Bash, PowerShell), uses gitleaks
  when installed, recognizes many more formats (including Midtrans, Xendit, and Telegram keys, `APP_KEY`, secret
  assignments, and database URLs with passwords), lets placeholders through, and scans the raw event when JSON
  parsing fails instead of letting the write through.
- A git guard hook blocks force-pushes and commands that skip hooks in the forms permission rules can't see:
  `git -C`, `git --no-pager`, quoted or abbreviated flags, `SKIP=`, `HUSKY=0`, `LEFTHOOK=0`, and `core.hooksPath`
  overrides, and chained, nested, `eval`, or `sh -c` commands. It reads commands the way a shell does, so commit
  messages (heredocs included) that only mention those flags pass. Its tests run under mawk, gawk, BSD awk, and
  busybox.
- Permission rules now block `git push -f`, `git push origin +branch`, `git commit -n`, and `core.hooksPath`
  overrides, and ask before `HUSKY=0`; deny reads of more secret files (Flutter `key.properties`, `.dev.vars`, Terraform
  state, Apple `.p8` keys, Composer `auth.json` per PHP app, and credentials in your home folder); and ask before
  more destructive database and Docker commands and before commands that print secrets.
- More secret and report files are git-ignored, and the plugin's own `.gitattributes` keeps scripts LF so hooks
  work on machines with `core.autocrlf`.
- CI pins every action to a commit SHA, doesn't persist the checkout token, pins its tools, runs on Linux and
  macOS, and installs gawk, BSD awk, and busybox so the git guard is tested in each.

## [1.1.0] - 2026-10-02
### Added
- Setup on session start, set with the plugin's `setup` option: `ask` (default) offers `/project-kit:kickoff` once
  per repo, `auto` installs the project layer with the detected apps before Claude's first reply, and `off` does
  nothing. It runs only at the root of a repository's main checkout, never in the home folder or CI, never over an
  existing CLAUDE.md, and a declined repo is not asked again.
- `kit.mjs detect`: suggests apps and stacks from stack markers, including MCP SDK dependencies. Kickoff uses it.
- `kit.mjs remove-app`, `kit.mjs uninstall` (removes what install created and nobody has edited, and restores
  merged files), and `kit.mjs skip`.

### Changed
- `add-app` and `remove-app` update the Project Profile tables while the profile block is still unedited.
- The session hook also prints the resume point when Claude starts in a subfolder of a kit project, and keeps its
  output under the context limit with a long git status.
- With no apps yet, the core rules cover the whole repository.
- Every `kit.mjs` command plans its changes, checks them, and only then writes. If a write fails, the changes made
  so far are undone. Nothing is written through a symbolic link or outside the project, and a manifest that names
  other paths is refused.
- Settings merges keep the project's rule order, indentation, and line endings, and sync doesn't add back a
  permission rule the project removed.

### Fixed
- Install overwrote templates and rules that were already in the repo (for example from the earlier single-file
  kit); it now keeps them and sync reports the difference.
- After skipping a locally edited kit file once, a later sync could overwrite it without a backup.
- Merging settings moved the project's own `Read(!…)` exceptions to the end of the deny list.

## [1.0.0] - 2026-10-01
### Added
- Project layer installer (`scripts/kit.mjs`): install, add-app, sync with local-edit protection, and doctor.
- Core rules for security, testing, database, API, and UI/UX; stack rules for Laravel, PHP, Ruby on Rails, .NET,
  Go, Flutter, Spring Boot, Python, HTML/CSS, Nuxt, Next.js, Node.js/TypeScript, MCP, and Playwright.
- Skills: kickoff, design-intake, ui-verify, e2e, mcp-build, security-gate, release, add-stack, sync, doctor.
- Agents: security-reviewer, ui-reviewer, test-reviewer.
- Hooks: session context (STATUS.md and git status at session start) and a secret guard for file writes.
- Helper scripts: palette.py, ui_compare.py, css-inventory.mjs.
- Playwright starter (config, fixtures with axe, auth setup, journey, API, visual, and capture specs, CI job) and
  Flutter integration_test and Maestro examples.
