# Changelog

All notable changes to project-kit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.6.0] - 2026-11-16
### Security
- Quick check commands from the manifest need approval on each machine. A command in `checks` of
  `.claude/project-kit.json` travels with the repo, and the hook ran it after every edit without asking. It now runs
  only where it was set (`kit.mjs check <app> --cmd …`) or approved (`kit.mjs check <app> --trust`); until then the
  hook skips it and tells Claude once per session, and `check` and `doctor` show it as not approved. Built-in checks
  of the stacks are unaffected. After updating, approve your existing custom checks once with `--trust`.
- Secret guard, built-in patterns: JSON Web Tokens, and named values in lower case or in YAML and JSON
  (`password: "…"`, `"apiKey": "…"`). Named values count only when they mix letters and digits, which ends the false
  blocks on header names, dotted paths, and numbers (`API_KEY_HEADER=X-Acme-Api-Key-Header`).

### Added
- `kit.mjs log "<text>"` adds a line to `05-progress/log.md` for what no status change records (a quick-lane fix, a
  release, a gate result); CLAUDE.md, the task, release, and security-gate skills name it.
- `kit.mjs new task --app` accepts an app that only the Profile's app table lists, so an app on a stack added with
  `/project-kit:add-stack` can have tasks.
- CI runs the guard, quick check, and `kit.mjs` suites on Windows.
- Rule paths: Twig, Haml, Slim, Jinja, and Go templates and ARB files load the UI rules; Symfony `Entity/` and
  `Repository/`, singular `model/`, and NestJS `*.entity.ts` load the database rule; NestJS controllers and
  resolvers load the API rule; Jenkins, CircleCI, Azure, and Bitbucket pipelines load the infra rule.
- .NET stack: a raw-SQL rule, as every other backend stack has.

### Fixed
- Rust quick check: `cargo fmt --check`, which reads the crate's edition; the old command forced the 2024 style and
  failed correctly formatted files of older editions.
- Python quick check honours the project's ruff excludes (`--force-exclude`).
- React Native build command: `npx eas-cli build` (`npx eas` runs an unrelated package).
- The quick check is skipped when ESLint is installed without a config, instead of failing after every edit.
- The API rule no longer loads for front-end file routes (`src/routes/index.tsx`).
- The rigor table is the single source for what each level needs: the testing and UI rules, the phase template, the
  e2e, ui-verify, and kickoff skills, and the Phase 00 checklist no longer ask for the coverage floor, visual
  baselines, or the test reviewer below production; the README's Phase 00 row matches the checklist.
- The manual install steps match what `install` writes (deny rules only, the full ignore list, `.gitattributes`,
  the glossary).
- Tests no longer touch `~/.claude/project-kit`, and resolve their own folder correctly on Windows.
- e2e templates: signed-in screens were skipped on the first visual or capture run, because the skip looked for the
  saved session file before the setup project had written it; it now looks at the credentials.
- plugin-build templates: the example hook treats `.ENV` like `.env` (one file on macOS and Windows), and the hook
  test no longer prints a stack trace for a hook that exits without reading its input.
- `css-inventory.mjs`: Sass and Less variables are counted; a `;` in a data URL or a quoted string no longer cuts a
  declaration short; `url(#id)` and quoted text are not colors; nested functions (`hsl(var(--h) …)`) stay whole;
  inline styles in single quotes and protocol-relative or unquoted CDN links are read; HTML comments are skipped;
  a bad `@import` URL or a dangling link no longer crashes it.
- `ui_compare.py` no longer crashes on a capture far wider than the reference.
- The weekly pin check failed open: it passed when npm could not be reached, and never flagged a 0.x pin once the
  package reached 1.x. CI no longer installs awk variants that no test used.

## [1.5.1] - 2026-11-16
### Fixed
- Quick check: the edited file's name now reaches the check command exactly as written. A name with `$` (a route
  file such as `$postId.tsx`) was expanded by the shell, so the check ran on the wrong path and reported a failure
  that wasn't there, and a name holding `$(…)` ran as a command.
- `kit.mjs new`: a title containing `$1`, `$&`, or similar no longer corrupts the heading of the new task, phase, or
  ADR file.
- Task ids past 999: `task-1000` and later are listed, started, and sorted after `task-999`; before, the file was
  created and then ignored by `next`, `board`, `start`, and `set`.
- Git guard: `git commit -uno` and `git commit -S<key id>` are no longer mistaken for `-n`; the newer
  `git config unset core.hooksPath` is blocked like `--unset`.
- Command guard: destructive commands are recognised behind `sudo`, `env`, `time`, `xargs`, and similar wrappers,
  with git's global options (`git -C api reset --hard`), and with `rm`'s flags in any spelling (`rm -rfv`,
  `rm -f -r`, `rm --recursive --force`).
- Secret guard: the built-in patterns catch an AWS secret access key written in lower case, as in
  `~/.aws/credentials`.
- Maintenance workflow: the evals job installs the Claude Code version pinned in `ci.yml`; its lookup matched
  nothing, so it installed the latest release instead.
- Session hook: STATUS.md is cut at a character, not in the middle of one.
- Command guard: `git branch -d` (the safe delete) no longer asks; only `-D` and `--delete --force` do. A phrase
  inside a commit message, a `gh` body, or an `echo`, such as "terraform apply", is no longer taken for the command.

### Added
- Command guard, asks in guarded and runs in auto: `git checkout -- <path>`, `git checkout .`, `git restore .`,
  `find … -delete`, and `dropdb`.
- Command guard, asks in guarded and is denied in auto: package publishing (`npm`, `pnpm`, `yarn`, `cargo`, `gem`,
  `twine`), deploys (`vercel`, `netlify`, `firebase`, `wrangler`, `fly`), `gh pr merge`, and `gh release create`.

## [1.5.0] - 2026-11-16
### Added
- Rigor levels: `prototype`, `standard` (default for new installs), and `production` set the tests, reviews, UI
  checks, docs, and Phase 00 groups a project needs; security rules apply at every level. Kickoff asks;
  `/project-kit:rigor` (`kit.mjs rigor`) changes it. Projects installed before 1.5.0 read as production.
- Daily loop commands: `kit.mjs new task|hotfix|phase|adr`, `start`, `set`, `next [--parallel]`, and `board` keep
  global ids (across branches), task files, the phase table, STATUS.md lines, and log.md consistent. The new
  `/project-kit:task` skill runs them, including parallel tasks in separate worktrees.
- Command guard hook: asks before destructive and secret-printing commands in guarded autonomy; in auto, lets the
  first run and denies the second. Autonomy is now per session: `PROJECT_KIT_AUTONOMY`, then
  `--dangerously-skip-permissions` (counts as auto), then the project default.
- Quick check after every edit (PostToolUse hook): the app's fast syntax or lint check on just that file, with
  defaults per stack and `kit.mjs check` to change them.
- `/project-kit:prototype`: a clickable HTML prototype of a feature's flows, reviewed before any code. Phases start
  with a thin end-to-end slice, and task Results carry evidence (screenshots, recordings, command output).
- Design quality: a design-quality core rule (the generated look to avoid, what to aim for, realistic content),
  screen patterns for common screen types, three rendered directions to pick from when no design exists, one
  component base per UI app, and a design-quality critique in `/project-kit:ui-verify`. DESIGN.md starts as an
  `UNCHOSEN` placeholder that blocks UI work, and doctor warns about it.
- Vite single-page app (React, Vue, Svelte) and React Native (Expo) stacks, with detection.
- `06-technical-docs/glossary.md` for the client's terms; Phase 00 reference slice and `patterns.md`; generated API
  clients from the OpenAPI spec; Context7 companion for current library docs; `lessons.md` line per hotfix.
- Starter repositories per stack (`kit.mjs starters set <stack> <git-url>`), cloned by Phase 00 instead of the
  framework generator.
- The session hook prints rigor and autonomy, and suggests sync when the project is on an older kit version. A
  prompt hook tells Claude when the session's autonomy differs from what it was told (SessionStart input doesn't
  always carry the permission mode, and Shift+Tab can change it mid-session).
- Kit maintenance: trigger evals for the skills Claude starts on its own (`evals/`), a weekly check of pinned
  versions (`tests/check-pins.mjs`), and a Maintenance workflow that runs both.

### Fixed
- Windows: the session hook compares project paths without regard to case and normalizes them as `kit.mjs skip`
  does, so the skip list and the repository-root check hold when a drive letter's case differs.

### Changed
- Hooks are Node.js scripts (secret guard, git guard, session start), so they run on Windows without Git Bash. The
  git guard's shell reader is a direct port with the same test cases.
- The kit no longer writes ask rules to `.claude/settings.json` (they prompt in every permission mode); sync takes
  out the ask rules and 1.4.0 auto-mode deny rules it had added. `kit.mjs autonomy` only sets the project default.
- `doctor`, `add-stack`, and `plugin-build` can be started by Claude, not only by the user.
- CLAUDE.md core block is shorter (about 150 lines); companion details moved into the task skill.
- `code-reviewer` runs on sonnet (opus at production rigor and for security-sensitive work); `ui-reviewer` runs
  on opus and critiques design quality.

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

### Fixed
- The kit's own CI: the session hook test for an unset `setup` option ran with `CI` set, where the hook stays
  silent by design, so the suite failed on every push since 1.3.0. The test now clears `CI` like the others do.

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
