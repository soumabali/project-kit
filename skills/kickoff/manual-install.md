# Manual install (no Node.js)

`kit.mjs` automates these steps. Without Node, do them by hand. Paths below are relative to the plugin folder
(two levels above this file):

1. Folders: `01-ideas/`, `02-prd/`, `03-phases/`, `04-tasks/hotfix/`, `05-progress/`, `06-technical-docs/api/`,
   `06-technical-docs/decisions/`, `06-technical-docs/design/references/`, `.claude/rules/project/`.
2. Copy `project-layer/templates/*` to `.claude/templates/`.
3. Copy `project-layer/rules/core/*.md` to `.claude/rules/kit/`, and each used stack's
   `project-layer/rules/stacks/<stack>.md` to `.claude/rules/kit/stack-<stack>.md`. In each copy, replace every
   `paths:` entry containing `{{APP}}` with one entry per app path (drop the `{{APP}}/` prefix for an app at the
   repo root), and delete the `kit:` line.
4. CLAUDE.md: copy `project-layer/CLAUDE.md`; replace `{{PROJECT_NAME}}`, `{{KIT_VERSION}}` (the plugin version),
   and the `{{APP_ROWS}}` and `{{COMMAND_ROWS}}` table rows. If AGENTS.md exists, put `@AGENTS.md` on the first line.
5. Merge `project-layer/settings.json` into `.claude/settings.json`: add missing `permissions.deny` and
   `permissions.ask` entries, and keep `Read(!.env.example)` last in `deny`. For `auto` autonomy, skip the ask
   entries and add the deny entries of `project-layer/settings-auto.json` instead.
6. Create `05-progress/STATUS.md` and `05-progress/log.md` from the templates, and `CHANGELOG.md` from
   `changelog.md` if missing.
7. Append the missing lines of the kit block to `.gitignore`: `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`,
   `CLAUDE.local.md`, `.claude/settings.local.json`, `.worktrees/`, `.auth/`, `playwright-report/`, `test-results/`,
   `blob-report/`, `coverage/`.

Without the manifest (`.claude/project-kit.json`), `/project-kit:sync` can't update these files later. Once Node is
available, move any project rules out of the two kit blocks, delete the blocks from CLAUDE.md, and run
`kit.mjs install --merge-claude-md --app …`. It keeps the rules and templates you copied, and
`kit.mjs sync --force` then brings them to the kit's version, saving each old file as `.orig`.
