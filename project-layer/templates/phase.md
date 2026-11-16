---
id: phase-01
title: ""
status: planned             # planned | active | done
prd: 02-prd/prd-<feature>-v1.md
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# phase-01: <title>

## Goal
The outcome a user can see at the end of this phase, in one or two sentences.

## Scope
- In:
- Out:

## Contract
Agreed and committed before the tasks below were written. Tasks implement it; a task that needs to change it says so
in its plan and gets the user's approval first. Phase 00 has none yet: its tasks create the first architecture,
data model, API spec, and ADR.
- Data model: sections of `06-technical-docs/data-model.md`
- API: paths in `06-technical-docs/api/openapi.yaml`
- Screens: ids in `06-technical-docs/design/screens.md`, built to the tokens and rules in `DESIGN.md`; for UI work,
  the prototype in `06-technical-docs/design/prototype/` the user walked through (`/project-kit:prototype`)
- Decisions: ADRs in `06-technical-docs/decisions/`

## Tasks
Status lives in each task file, so task branches never edit this table. The task skill adds rows. The first task is a
thin slice: the simplest version of the main journey working end to end (UI, API, database), shown to the user
before the other tasks start, so a misunderstanding costs a day, not a phase.

| id | title | app | depends_on |
|---|---|---|---|
| task-001 | | | |

## Definition of Done
- [ ] Every task is `done` or `cancelled` with a reason
- [ ] Production rigor: `project-kit:test-reviewer` judged the phase's E2E and integration suites sufficient
- [ ] The full end-to-end suite is green against staging, and the demo below runs there (Phase 00: green in CI
      against the composed stack, since staging may not exist yet)
- [ ] Designed screens pass `/project-kit:ui-verify` (standard and production); visual baselines are committed (production)
- [ ] `[Unreleased]` in CHANGELOG.md covers the phase
- [ ] Architecture, data model, API spec, DESIGN.md, and runbook are current
- [ ] The user signed off

## Demo
Steps a person follows to see the goal working.
1. …
