---
paths:
  - "**/*.{test,spec}.*"
  - "**/*_test.{go,dart,py}"
  - "**/test_*.py"
  - "**/*Test.{java,kt,cs,php}"
  - "**/*Tests.cs"
  - "**/*_spec.rb"
  - "**/{test,tests,spec,__tests__,e2e,integration_test}/**/*"
  - "**/playwright.config.*"
  - "**/.maestro/**/*"
---

# Testing Rules

## What "tested" means here
- Unit tests cover domain and business logic, pure algorithms, state transitions, complex validation, and error
  boundaries, with at least 80% line coverage there at production rigor (CLAUDE.md §2). Don't unit-test framework internals, generated code, simple
  passthroughs, or markup without logic; integration, E2E, and visual tests cover those.
- Integration tests go through the real HTTP layer and a real database (docker compose service or Testcontainers);
  never mock your own ORM, repositories, or framework.
- Every critical user journey has an end-to-end test against a running build: the core workflows the product
  exists for, its security gates (sign-in, permission denial), and destructive or irreversible actions. Use
  Playwright for web (any backend), `integration_test` or Patrol for Flutter, and Maestro for native interactions.
  Cover the happy path and the most likely failure.
- Every protected endpoint has negative tests: unauthenticated (401), expired or invalid token (401), another
  user's resource (403 or 404), wrong role (403), invalid input (422 or 400).
- Mock only third-party services you don't control, at the network boundary (MSW, WireMock, `Http::fake`, httptest servers). Keep one contract or sandbox test per integration.
- Designed screens get an axe scan and, at production rigor, visual snapshots (`/project-kit:ui-verify` sets them up).

## Writing tests
- Test behavior through public interfaces, not implementation details. Names state the behavior: `rejects_booking_for_another_users_room`.
- Arrange data with factories or API calls in the test; never depend on data from another test or on run order.
- Deterministic: freeze time, seed randomness, no sleeps. Wait on conditions (Playwright web-first assertions, `pumpAndSettle`, polling helpers) instead of timeouts.
- Playwright: locate by role, label, or text (`getByRole`, `getByLabel`), which also proves the element is
  accessible; use a dedicated `data-testid` when nothing semantic exists; never CSS or XPath tied to layout.
  `await` every action (lint with `no-floating-promises`).
- One behavior per test, with assertions on the outcome the user sees or the data stored.

## Running tests
- Run the narrowest test while iterating, then the app's full suite before calling anything done.
- E2E in CI runs against a production build (`next build && next start`, `nuxi build`, compiled backend), not a dev server.
- A flaky test is a bug: reproduce it with repeated runs (`--repeat-each`, `-count=20`), then fix it. Never mark it skipped without a task id.
- Keep Playwright traces, screenshots, and videos for failures as CI artifacts (`trace: 'on-first-retry'`).
- Optional, valuable for APIs: property-based or schema-driven fuzzing from the OpenAPI spec (Schemathesis) and a k6 smoke test before releases.
