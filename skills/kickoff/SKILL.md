---
name: kickoff
description: Start a new project, adopt an existing repo, or finish a repo that automatic setup installed, with project-kit. Interviews once, installs or corrects the project layer (CLAUDE.md, path-scoped rules, templates, permissions, tracking folders), then runs or resumes Phase 00 foundation.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:kickoff

Goal: a repo where any session can resume from files, every app has its stack rules loaded, and Phase 00 leaves
working quality, security, and test gates. Track this work like any other: Phase 00 gets a phase file and tasks.
If `03-phases/phase-00-foundation.md` already exists, skip to step 5 and resume there.

## 1. Look before asking
- If `.claude/project-kit.json` exists (automatic setup or an earlier kickoff already installed the layer), read
  its `apps` and the CLAUDE.md profile; you'll confirm and correct them instead of installing (step 4).
- Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" detect` for a first map of apps and stacks. It reads stack
  markers (Claude Code plugin manifests and `SKILL.md` files among them) at the root, in `07-application/*`,
  `apps/*`, `services/*`, `packages/*`, and `plugins/*`, at each path a root `marketplace.json` lists, and in
  folders such as `frontend/`, `backend/`, and `mobile/`, and adds `+mcp` for an MCP SDK dependency. Treat it as a
  suggestion.
- Inspect the rest: framework versions (lockfiles), package managers, Docker files, CI, tests, docs, an existing
  CLAUDE.md or AGENTS.md, and design sources (DESIGN.md, `*.fig` exports, HTML templates, image folders).
- Where detection misses an app or picks the wrong stack, use the closest id from `kit.mjs stacks`. For a stack
  the kit lacks, install with the closest one now, then run `/project-kit:add-stack <stack> <path>` after step 4.
- New apps: `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" starters` lists the user's starter repositories per stack
  (their own templates with auth, CI, Docker, components, and common modules already done). Phase 00 clones a
  starter instead of running the framework's generator when one fits. Web UIs also get an `e2e` app on the `playwright` stack
  (default path `07-application/e2e`).

## 2. Ask once
Skip anything the repo already answered.
- One AskUserQuestion call, up to four multiple-choice questions: the apps and stacks you found (confirm or
  correct; new projects default to `07-application/<app>`, existing repos keep their layout, and an app at the repo
  root uses path `.`), the rigor (prototype for a demo, spike, or internal tool; standard for most client work;
  production for long-lived or regulated systems), the design source (DESIGN.md, HTML template, JPG/PNG mockups or
  theme screenshots, Figma, live site, none yet), and data sensitivity (none, personal data, payments, health).
- Then, in one plain-text message: what the product is, who it's for, why it exists, its locales, hosting, two or
  three products they like or compete with, and the client's key terms. Save client inputs (briefs, RFPs, meeting
  notes, reference links, sample data) in `01-ideas/`.
- In a project already in `auto` autonomy mode, or when the user said not to ask (an unattended run): skip the
  questions, take the detected apps and what the repo and `01-ideas/` say, leave the rest `TBD` in the profile, and
  list in STATUS.md what the user still has to confirm.

## 3. Check companions
Read `${CLAUDE_PLUGIN_ROOT}/skills/kickoff/companions.md`. Compare its list with the skills available in this
session and give the user the install commands for the missing ones that fit this project (timedoor-laravel only
for Laravel apps; impeccable only when there is UI). Continue without waiting; the kit works without them.

## 4. Install the project layer
Already installed (`.claude/project-kit.json` exists):
1. Correct the app list to match the interview with
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" add-app --app <name>=<stack>:<path>` and
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" remove-app <name>`. While the profile block is unedited they
   update its tables themselves.
2. Fill **What**, **Why**, and **Environments** in the profile block, and replace the folder name in its title with
   the product name.

Not installed yet:
1. Dry run and show the user the plan:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" install --name "<Product>" --app <name>=<stack>[+<stack>]:<path> … --dry-run`
2. If CLAUDE.md already exists, read it, tell the user what conflicts with the kit, and rerun with
   `--merge-claude-md` once they agree. After merging, remove the contradictions they approve. Existing templates
   and rules are kept; the output lists them.
3. Run the same command without `--dry-run`, with `--rigor <level>` from the interview. Add `--autonomy auto` only
   when the user wants unattended development by default for everyone in the repo; a single session gets it with
   `PROJECT_KIT_AUTONOMY=auto` or `--dangerously-skip-permissions` anyway.
4. Fill **What**, **Why**, and **Environments** in the CLAUDE.md profile block from the interview, and the
   client's terms in `06-technical-docs/glossary.md`.
- No Node.js available: follow the file mapping in `${CLAUDE_PLUGIN_ROOT}/skills/kickoff/manual-install.md` instead.

## 5. Phase 00 foundation
If `03-phases/phase-00-foundation.md` exists, resume at its first task that isn't `done`. Otherwise create it with
`node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" new phase --phase phase-00 --title "Foundation"`, plus one task per group that
`${CLAUDE_PLUGIN_ROOT}/skills/kickoff/phase-00.md` lists for the project's rigor, each with `kit.mjs new task`. Phase 00
tasks are ordinary tasks: global ids, a branch and commits per task (CLAUDE.md §7), the build loop, and the
Definition of Done. Along the way:
- Apps with UI: run `/project-kit:design-intake` before building screens; DESIGN.md starts `UNCHOSEN`.
- Every app: run `/project-kit:e2e` to set up its real tests (integration with a real database, end-to-end against a
  running build).
- MCP apps: follow `/project-kit:mcp-build` for scaffolding and tests.
- Claude Code skill and plugin apps: follow `/project-kit:plugin-build` (validation, hook tests, evals).

## 6. Close Phase 00
- Run every command in the Profile; replace each `(verify)` with the confirmed command, or fix the setup.
- Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" doctor` and resolve every FAIL.
- At production rigor, have `project-kit:test-reviewer` review the suites (phase Definition of Done). Then mark
  the phase `done`.
- Set STATUS.md's next step to "brainstorm the first feature (superpowers brainstorming → 02-prd/)".
- Ask the user whether to push the task branches and open pull requests or merge them locally.
- Hand the user the repo settings checklist from phase-00.md (only they can change those).
