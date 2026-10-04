# Companion plugins

project-kit works alone and gets better with these. Check the skills available in the session for each name.

| Plugin | Gives the kit | Install (Claude Code) | When |
|---|---|---|---|
| superpowers | `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review` | `/plugin install superpowers@claude-plugins-official` | always |
| ponytail | minimal-code discipline, `/ponytail-review`, `/ponytail-audit` | `/plugin marketplace add DietrichGebert/ponytail` then `/plugin install ponytail@ponytail` | always |
| token-router | model routing (td-simple, td-normal, td-high), `/token-router:graph-index` for graphify | `/plugin marketplace add soumabali/token-router` then `/plugin install token-router@td-router`, then `/token-router:setup` | always |
| impeccable | design fluency: `/impeccable init` (PRODUCT.md), `shape`, `critique`, `audit`, `polish`, `harden`, `adapt`; `npx impeccable detect` | `/plugin marketplace add pbakaus/impeccable` then `/plugin install impeccable@impeccable` | projects with UI |
| skill-creator | skill evals with a no-skill baseline, description tuning for reliable triggering | `/plugin install skill-creator@claude-plugins-official` | projects that build skills or plugins |
| timedoor-laravel | `laravel-standards`, `/timedoor-laravel:review-code` | `/plugin marketplace add backend-timedoor/timedoor-laravel` then `/plugin install timedoor-laravel@timedoor-laravel-marketplace` | Laravel apps |

Command-line tools (no install needed with npx):
- DESIGN.md: `npx @google/design.md lint DESIGN.md` · `diff` · `export --format css-tailwind|json-tailwind|css-vars|dtcg`
- MCP Inspector: `npx --yes @modelcontextprotocol/inspector@<version> --cli <server command> -- --method tools/list --format json --protocol-era auto`
- Secret scanning: gitleaks (installed per machine or in CI)

## How they divide the work
- Product and feature planning: superpowers `brainstorming` (writes the PRD in `02-prd/`), then the design step
  (the phase's contract: data model, API, screens, ADRs), then `writing-plans` (writes the phase and task files). Execute one task file per session with `executing-plans`, or with
  `subagent-driven-development` limited to that task; branches and commits follow CLAUDE.md §7. impeccable `shape`
  plans the UX of one screen or flow, after the PRD exists.
- Visual direction: DESIGN.md is the shared contract. impeccable reads it; `/project-kit:design-intake` writes it.
  token-router's `/token-router:frontend-design` overlaps with impeccable; prefer impeccable for design work.
- Code: ponytail keeps it minimal; the stack skill (for example `timedoor-laravel:laravel-standards`) decides
  conventions; the kit rules decide security and test gates.
- Where they disagree: the user's request; then the project's own rules and profile; then CLAUDE.md and the kit
  rules for process, security, and test gates; then the stack skill for code conventions; then other plugins'
  defaults. A flourish from impeccable (`delight`, `overdrive`) ships only if the PRD or DESIGN.md asks for it.
