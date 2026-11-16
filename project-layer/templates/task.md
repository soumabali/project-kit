---
id: task-000                # or hotfix-000; 3-digit, global, never reused
type: feat                  # feat | fix | refactor | test | docs | chore (the commit type)
title: ""
phase: phase-01             # or hotfix
app: backend                # app name(s) from the Project Profile
status: todo                # backlog | todo | in-progress | blocked | in-review | done | cancelled
owner: claude
security_sensitive: false   # true → negative tests + /project-kit:security-gate
approval_required: false    # true when CLAUDE.md §5 "Ask first" lists the change
ui: false                   # true → screens below + /project-kit:ui-verify
changelog_entry: pending    # pending | written | not-applicable
depends_on: []
parent_id: null             # set for split tasks (task-014-a → task-014)
blocked_reason: null
retroactive: false          # true when recorded after the code was written
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# task-000: <title>

## Context
Why this exists. Link the PRD section, phase, or bug report.

## Acceptance Criteria
- [ ] AC1: Given …, when …, then …

## Test Plan
Write these first and watch them fail. Keep the negative rows for anything security-sensitive.

| # | Scenario | Level | Test (file::name) | Covers |
|---|---|---|---|---|
| T1 | Happy path … | integration | | AC1 |
| T2 | Unauthenticated → 401 | integration | | security |
| T3 | Expired or invalid token → 401 | integration | | security |
| T4 | Another user's resource → 403 or 404 | integration | | security |
| T5 | Wrong role → 403 | integration | | security |
| T6 | Invalid input → 422 | integration | | AC1 |
| T7 | User completes the flow in the browser or app | e2e | | AC1 |

Levels: unit (pure logic) · integration (real database and HTTP, no mocked ORM) · e2e (running build, real browser or device) · visual (screenshot baseline) · a11y (axe).

## UI (only when `ui: true`)
| Screen id | States to build | Reference | Breakpoints |
|---|---|---|---|
| | loading, empty, error, success | `06-technical-docs/design/references/…` | 390, 768, 1440 |

## Security (only when `security_sensitive: true`)
- **Threat sketch:** assets, entry points, who could abuse them and how
- **Gate result:** `/project-kit:security-gate` checklist with evidence, scanner results, reviewer verdict

## Plan
Files to change, then bite-sized steps, each with the check that proves it.
1. <step> → verify: <command or observable result>
2. <step> → verify: <command or observable result>

## Hotfix only
- **Reproduction steps:**
- **Root cause:**
- **Regression test:** fails before the fix, passes after
- **Impact:** who was affected and for how long (production incidents only)

## Result
Filled in at close, or when parking the task.
- **What changed:**
- **Checks run:** `<command>` → result, one line each
- **Evidence:** per acceptance criterion, what the user can check without running anything (screenshot path,
  recording, or command and output)
- **Seen red first:** <test name>
- **UI verification:** screens and breakpoints checked, open differences (if `ui: true`)
- **Decisions:** calls made without asking (in `auto` autonomy) with why and how to undo; an ADR for anything lasting
- **Follow-ups:** new task ids (never TODOs in code)
- **Stopped at / next step:** only while the task is parked
