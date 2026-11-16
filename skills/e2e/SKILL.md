---
name: e2e
description: Set up and write real tests. Playwright end-to-end suites for any web app (any backend), API black-box tests, Flutter integration_test/Patrol/Maestro, integration tests on real databases, plus optional k6 and Schemathesis. Use when a project or task needs E2E, integration, visual, accessibility, or API tests.
argument-hint: "[app name]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" *)
---

# /project-kit:e2e $ARGUMENTS

Goal: tests that prove the product works the way users (and attackers) will exercise it, against running code
and real dependencies. Starter files live in `${CLAUDE_PLUGIN_ROOT}/skills/e2e/templates/`.

## 1. Every app: integration tests on real dependencies
- The app's suite must run against a real database (docker compose service or Testcontainers), following the
  Testing section of its stack rules. Set that up first if it's missing.
- Each endpoint group gets integration tests for success plus 401, 403 (another user's resource), and 422.

## 2. Web apps: the Playwright e2e app
1. Create the e2e app (default `07-application/e2e`) by copying from the templates folder: `playwright.config.ts`,
   `package.json`, `tsconfig.json`, `eslint.config.mjs`, `screens.ts`, and `tests/`. If it isn't in the Profile yet,
   register it: `node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" add-app --app e2e=playwright:07-application/e2e`.
2. Install from the e2e folder:
   `npm i -D @playwright/test@latest @axe-core/playwright typescript@~6.0 typescript-eslint eslint @types/node@<major>` (the Node major the project runs, from `.nvmrc` or `engines`), then
   `npx playwright install --with-deps`. (typescript-eslint doesn't support TypeScript 7 yet; keep `typescript` in
   its peer range.)
3. Visual tests and their baselines both run inside the official Playwright Docker image that matches the
   installed version (`npm run test:visual` and `npm run test:visual:update` pick the tag automatically), so every
   machine renders like CI. On macOS or Windows Docker, point `BASE_URL` at `http://host.docker.internal:<port>`;
   run the npm scripts from a POSIX shell (Git Bash or WSL on Windows).
4. Reaching the stack: CI starts it with docker compose using production builds and sets `BASE_URL`. Locally,
   either run the stack or set `E2E_WEB_SERVER` to a command that serves a production build.
5. Test users: seed one account per role in the backend's test-only seeder; pass credentials through env
   (`E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, …) and CI secrets. `tests/auth.setup.ts` signs in once per role;
   `.auth/` holds session state and is git-ignored.
6. One spec per critical user journey in the PRD (`tests/flows/<journey>.spec.ts`): the happy path and the most
   likely failure. Always include the security gates (sign in, permission denied, another user's resource through
   the UI) and destructive actions (confirm, undo or irreversible outcome).
7. API black-box tests with the `request` fixture (`tests/api.spec.ts`) for the public API contract, including 401
   and 403.
8. Copy every screen from `06-technical-docs/design/screens.md` into `screens.ts`; `tests/visual.spec.ts` then
   snapshots each screen, state, and breakpoint and runs axe on it.
9. Prove stability: run new specs with `npx playwright test --repeat-each=5` before calling them done.
10. CI: copy `templates/e2e-ci.yml` to `.github/workflows/e2e.yml` and set the stack start command and secrets. Its
   actions are pinned to commit SHAs, and the sign-in setup records no traces, so reports never hold passwords.

Optional helpers, always reviewed against these rules before committing:
- Playwright Test Agents draft test plans, generate tests, and heal failures: `npx playwright init-agents --help`
  lists the loops; choose the Claude Code one.
- Playwright MCP (`claude mcp add playwright -- npx @playwright/mcp@latest`) for exploratory checks in a real browser.

## 3. Flutter apps
- Widget tests for every UI state and golden tests for designed components (bundled fonts, fixed surface sizes).
- `integration_test/` on an emulator or device for critical journeys (`templates/flutter/app_test.dart`); run with
  `flutter test integration_test --dart-define=E2E_USER_EMAIL=… --dart-define=E2E_USER_PASSWORD=…` using test-only accounts.
- Patrol when tests must handle native permission dialogs or notifications; Maestro for black-box flows on CI
  emulators (`templates/flutter/sign-in.yaml`, run with `maestro test -e E2E_USER_EMAIL=… -e E2E_USER_PASSWORD=… <flow>`).

## 4. MCP servers, skills, and plugins
Follow the Test section of `/project-kit:mcp-build` (handler tests, in-memory protocol tests, Inspector CLI in CI)
and of `/project-kit:plugin-build` (`claude plugin validate --strict`, hook tests, must-trigger and must-not-trigger evals).

## 5. Before the first production release
- k6 smoke test on the critical endpoints with thresholds from the PRD (for example p95 latency and error rate).
- Schemathesis against the OpenAPI spec: `uvx schemathesis run 06-technical-docs/api/openapi.yaml --url <base-url>`;
  fix every 5xx and schema violation it finds.

## Done when
Every critical journey has a green end-to-end test in CI, every protected endpoint has negative tests, designed
screens pass axe, and new specs survive `--repeat-each=5`. At production rigor (CLAUDE.md §2), designed screens
also have visual baselines and `project-kit:test-reviewer` (given the task file and diff range) judged the tests
sufficient.
