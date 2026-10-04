---
paths:
  - "{{APP}}/**/*.{ts,js,mjs}"
  - "{{APP}}/package.json"
kit: {"name": "Playwright end-to-end suite", "commands": {"setup": "npm ci && npx playwright install --with-deps", "dev": "npx playwright test --ui", "test": "npx playwright test", "testOne": "npx playwright test -g \"<name>\"", "lint": "npx eslint .", "types": "npx tsc --noEmit", "audit": "npm audit --audit-level=high"}}
---

# Stack: Playwright end-to-end suite

- This app tests the other apps from the outside: browsers against the running stack, the same way users reach it.
  `/project-kit:e2e` sets it up; `/project-kit:ui-verify` adds visual checks.
- `playwright.config.ts` starts or reaches the stack through `webServer` or `BASE_URL`; CI runs against production builds.

## Writing tests
- One spec per user flow from the PRD (`flows/<flow>.spec.ts`); screens listed once in `screens.ts`.
- Locate by role, label, or text; `data-testid` only when nothing semantic exists. Use web-first assertions
  (`await expect(locator).toBeVisible()`); never `waitForTimeout`.
- Each test creates its own data through the API or a seed endpoint that exists only in test environments, and
  never depends on another test.
- Sign in once per role in a setup project and reuse `storageState`; tests that check sign-in itself start signed out.
- Third-party services are mocked with `page.route`; your own backend never is.

## Visual and accessibility
- `toHaveScreenshot()` with animations disabled and dynamic regions masked; baselines are generated in the official
  Playwright Docker image so they match CI.
- Every screen gets an axe scan (WCAG 2.x A and AA tags) through the shared fixture; violations fail the test.
- `toMatchAriaSnapshot()` for structure that must not regress (navigation, forms).

## Quality gates
- typescript-eslint with `no-floating-promises`, `tsc --noEmit`, and traces kept on the first retry (`trace: 'on-first-retry'`),
  except in the sign-in setup project, whose traces would hold test passwords.
- Pin `typescript@~6.0` in devDependencies: typescript-eslint and vue-tsc need the TypeScript 6 compiler API,
  which TypeScript 7 doesn't ship. Never turn off type-aware rules to get green.
