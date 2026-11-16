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
5. Merge `project-layer/settings.json` into `.claude/settings.json`: add the missing `permissions.deny` entries
   and keep `Read(!.env.example)` last in `deny`. (The kit adds no ask rules; the command guard hook asks instead.)
6. Create `05-progress/STATUS.md` and `05-progress/log.md` from the templates, and, if missing, `CHANGELOG.md` from
   `changelog.md` and `06-technical-docs/glossary.md` from `glossary.md`.
7. Append the missing lines to `.gitignore` under a `# project-kit` line: `.env`, `.env.*`, `!.env.example`,
   `.envrc`, `.dev.vars*`, `*.pem`, `*.key`, `*.p8`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `key.properties`,
   `*.tfstate`, `*.tfstate.*`, `CLAUDE.local.md`, `.claude/settings.local.json`, `*.orig`, `.worktrees/`, `.auth/`,
   `playwright-report/`, `test-results/`, `blob-report/`, `ui-verify/`, `coverage/`.
8. Append to `.gitattributes` under a `# project-kit` line: `05-progress/log.md merge=union` and
   `CHANGELOG.md merge=union`, so two branches that both add a line merge without a conflict.

Without the manifest (`.claude/project-kit.json`), `/project-kit:sync` can't update these files later. Once Node is
available, move any project rules out of the two kit blocks, delete the blocks from CLAUDE.md, and run
`kit.mjs install --merge-claude-md --app …`. It keeps the rules and templates you copied, and
`kit.mjs sync --force` then brings them to the kit's version, saving each old file as `.orig`.
