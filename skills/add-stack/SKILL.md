---
name: add-stack
description: Add rules for a stack the kit doesn't cover yet (for example Swift, Kotlin Android, Elixir, Astro, SvelteKit) or for a new app in this project, built from the framework's official docs.
argument-hint: "<stack-name> [app-path]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:add-stack $ARGUMENTS

## A new app on a stack the kit already has
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" add-app --app <name>=<stack>:<path>`. If the profile block in
CLAUDE.md was already edited, add the printed rows to its tables yourself (an unedited block is updated for you).
Then confirm each `(verify)` command. An app that's gone or was misdetected:
`node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" remove-app <name>`.

## A stack the kit doesn't cover
1. Find the installed version (lockfile or toolchain) and read the framework's official docs for that version:
   project structure, security guide, testing guide, and recommended tooling.
2. Copy `.claude/templates/stack-rule.md` to `.claude/rules/project/stack-<name>.md` (project-owned, so sync never
   overwrites it). Scope `paths:` to the app folder and the stack's file extensions. Keep its first line telling
   Claude to read `.claude/rules/kit/security.md`, `testing.md`, `api.md`, and `database.md` before editing, because
   those core rules match only the kit's known file types.
3. Fill each section in under 50 lines: only what Claude would get wrong without being told. Cite the docs version
   in the header. Skip generic advice the core rules already cover.
4. If kickoff registered the app under a stand-in stack, remove it with
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" remove-app <name>`. Add the app to the Profile tables in CLAUDE.md
   with its confirmed commands.
5. Suggest contributing the file back to the plugin's `project-layer/rules/stacks/` (add a `kit:` metadata line
   and `{{APP}}` path placeholders) so the next project gets it.
