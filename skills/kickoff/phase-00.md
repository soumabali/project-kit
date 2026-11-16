# Phase 00 checklist

Create one task per group the project's rigor needs, with `kit.mjs new task` (global ids, branches, and commits
exactly like later tasks). Ask the user only for what the repo can't tell you.

| Group | prototype | standard | production |
|---|---|---|---|
| 1. Apps | yes | yes | yes |
| 2. Security baseline | secret scan and `.env.example` only | yes | yes |
| 3. Local environment | yes | yes | yes |
| 4. Tests that prove it works | one smoke journey | yes | yes |
| 5. CI | lint, tests, secret scan | yes | yes, with every optional scanner the user accepts |
| 6. Reference slice | — | yes | yes |
| 7. Docs | README only | yes | yes |

## 1. Apps
- New app: clone the user's starter for the stack when `kit.mjs starters` lists one (`git clone --depth 1 <url>
  <app path>`, then remove its `.git`, rename the project, and record the starter's commit in an ADR); its done
  parts satisfy the matching groups below, so check them instead of rebuilding them. Otherwise scaffold with the
  official generator at the current stable or LTS version (look it up; don't assume). Commit the lockfile.
- Confirm each app's quick check (`kit.mjs check` lists them) runs and is fast: save a file with a syntax error and
  see the hook report it, or set a better command with `kit.mjs check <app> --cmd …`.
- Generate API types or a client for every app that calls the API from `06-technical-docs/api/openapi.yaml`
  (openapi-typescript or orval for TypeScript, openapi-generator for Dart and others), with a script that
  regenerates them.
- Wire a formatter, linter, type checker, and test runner with coverage for every app. Make each Profile command
  work and record the confirmed command in CLAUDE.md.
- Laravel apps: add Larastan (`larastan/larastan`) with a `phpstan.neon` at the highest level the code passes; the
  skeleton ships without it, and the Types command depends on it.

## 2. Security baseline
- `.env.example` lists every variable name with a placeholder and a comment. Each app validates required env vars
  at startup and fails fast.
- Pre-commit hook (pre-commit, lefthook, or husky, whichever fits the stack) running the format check and a secret
  scan (gitleaks). Prove it blocks a fake key, then delete the test file.
- Security headers, CORS allowlist, rate limiting on auth routes, request body size limits, debug off outside local.
- `/health` (liveness) and `/ready` (readiness: database and cache reachable) for every service.
- Structured logging with a request id; an error tracking SDK wired through env (DSN as a placeholder).

## 3. Local environment
- Docker Compose (or a devcontainer) for the apps, database, cache, and a mail catcher; `docker compose up -d --wait`
  starts everything; dev seed data. Document it in README.md and `06-technical-docs/runbook.md` (template:
  `.claude/templates/runbook.md`).

## 4. Tests that prove it works
- Run `/project-kit:e2e` for each app: integration tests against the real database, and the Playwright e2e app (or
  Flutter `integration_test`/Maestro) with one smoke journey green.

## 5. CI (GitHub Actions unless the repo uses something else)
For every app, on every pull request and push to main: install from the lockfile (frozen) → format check → lint →
type check → tests with coverage (fail below 80% of lines in domain logic, or the floor the user picks) → build →
dependency audit (fail on high or critical) → secret scan (gitleaks) → migrations from an empty database plus a
rollback of the newest (apps with a database) → E2E against the composed stack, uploading Playwright reports.
Pin third-party actions to commit SHAs, set least-privilege `permissions:`, and cache dependencies.
Offer, don't impose: SAST (Semgrep or CodeQL), container scanning (Trivy), Dependabot or Renovate, `npx impeccable detect --json` for UI.

## 6. Reference slice
One small feature built end to end to the full standard (a list and detail screen with its API endpoints,
validation, authorization, tests at every level, realistic seed data), picked from the first PRD when there is one.
Then write `.claude/rules/project/patterns.md` (paths: the app folders) pointing at its files as the pattern to copy
for controllers or handlers, services, validation, tests, and screens. Later tasks read it before creating files.

## 7. Docs
- `06-technical-docs/architecture.md`: a Mermaid diagram of apps, data stores, external services, and trust boundaries.
- `06-technical-docs/data-model.md` and `06-technical-docs/api/openapi.yaml` with the error format defined.
- `06-technical-docs/decisions/ADR-001-stack-and-hosting.md` from the ADR template.
- README.md: what it is, how to run it, how to test it, where the runbook is.

## Repo settings only the user can change
Protect main (pull request required, required status checks, no force push), enable secret scanning with push
protection, enable Dependabot alerts, add CI secrets to the secret store, and create staging and production
environments with required reviewers.
