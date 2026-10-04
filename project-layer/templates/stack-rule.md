---
paths:
  - "07-application/<app>/**/*.<ext>"
---

# Stack: <framework> <major version> (app: <app>)
<!-- Created by /project-kit:add-stack from the framework's official docs for the installed version.
     Save as .claude/rules/project/stack-<name>.md (project-owned; sync never touches it). Keep it under 50 lines.
     Scope paths: to the app folder and the stack's file extensions. -->

- Before editing this app, read `.claude/rules/kit/security.md`, `testing.md`, `api.md`, and `database.md`: their
  paths cover only the kit's known file types, so they don't load for this stack by themselves.
- Stack skill: <plugin:skill> or none. If one is named, invoke it before reading or editing this app's code.
- Versions: runtime <x>, framework <y>, pinned in <lockfile>. Check them before using version-specific APIs.

## Structure
Where handlers, domain logic, data access, and serializers live; the request-to-response path.

## Security specifics
The framework's authorization mechanism, validator, output escaping, CSRF handling, and secret loading.

## Testing
Framework and folders; real database in integration tests; HTTP-level tests incl. 401/403/404/422;
how E2E runs (Playwright from the e2e app, or the platform's device tests).

## Quality gates
Formatter, linter, type checker and level, dependency audit command.

## Pitfalls seen in this project
Add a line whenever the same mistake happens twice.
