---
name: release
description: Cut a versioned release. Verifies every app, runs the security gate, versions and tags, deploys to staging and then production only with explicit approval, smoke-tests with the E2E suite, and records it. Use only when the user asks for a release or a deploy.
disable-model-invocation: true
argument-hint: "[major|minor|patch]"
---

# /project-kit:release $ARGUMENTS

Stop at the first failed step, report it to the user, and record it in STATUS.md. Keep the evidence in a release
record, `05-progress/releases/v<version>.md`: create it first, then add each check's command and result as you go.

## 1. Preconditions
- On main (or the release branch), clean working tree, up to date with the remote, CI green on the release commit.
- Every task in scope is `done`; no task is `blocked` by a security finding; STATUS.md lists no blockers.

## 2. Verify
- Run every Profile check for every app: tests, lint, types, build, audit.
- Run the full E2E suite, including visual tests, against a production build of the release commit.
- Run `/project-kit:security-gate` scoped to everything since the last tag.
- For each migration since the last tag: is it compatible with the code currently deployed, and reversible? Are
  destructive ones approved, with a backup step in the runbook?
- First production release, or a change to a hot path: run the k6 smoke test against the PRD's performance targets.

## 3. Version and changelog
- SemVer from `[Unreleased]`: Removed or breaking → major (minor while the version is 0.x); Added or Changed →
  minor; only Fixed or Security → patch. An argument overrides this.
- Move the `[Unreleased]` entries under `## [x.y.z] - YYYY-MM-DD`, leave an empty `[Unreleased]` above it, bump
  the version files (mobile apps: version name and build number), commit `chore(release): vx.y.z`, and create an
  annotated tag `vx.y.z`.
- Ask before pushing the commit and the tag.

## 4. Deploy (follow the runbook)
- State the rollback plan before deploying: the previous tag, plus a migration rollback or a forward fix.
- Staging first: deploy, run migrations, run the E2E smoke journeys against staging, and check the error tracker,
  logs, and health endpoints.
- Production only after the user says go for this exact version. Run the same smoke journeys, then watch errors
  and latency for the agreed window. Mobile: submit store builds to internal or beta tracks before production.

## 5. Record
Finish the release record (versions deployed, times, smoke results, rollback plan), add one line to
`05-progress/log.md` (`node "${CLAUDE_PLUGIN_ROOT}/scripts/kit.mjs" log "release v<version>: …"`), update STATUS.md, and update the runbook if the process changed.
