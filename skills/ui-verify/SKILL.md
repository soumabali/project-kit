---
name: ui-verify
description: Verify implemented screens against DESIGN.md and the reference designs. Captures Playwright screenshots at every breakpoint, builds side-by-side diffs, has the ui-reviewer agent list differences, runs axe and impeccable checks, then locks visual baselines. Use after building or changing any screen.
argument-hint: "[screen id ...]"
---

# /project-kit:ui-verify $ARGUMENTS

Scope: the screens in `$ARGUMENTS`, or every screen the current task builds or changes (from
`06-technical-docs/design/screens.md` and the task's acceptance criteria). Needs the e2e app from `/project-kit:e2e` (it provides `screens.ts` and `ui-capture.spec.ts`).

## 1. Capture
1. Start the stack the way CI does (production build), then run the capture spec:
   `npm run capture` (from the e2e app). It writes `ui-verify/<screen>-<state>-<width>.png` (git-ignored, and kept
   between runs) for every screen, state, and breakpoint, and fails on any axe violation in a captured state.
   Screens that need a signed-in role are skipped until that role's `E2E_*` credentials are set.
2. For each capture that has a reference image, build a comparison sheet:
   `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/ui_compare.py" <reference.png> ui-verify/<capture>.png ui-verify/compare/<capture>.png`
   It prints a similarity score and writes reference, actual, and difference side by side.

## 2. Review
Delegate to the `project-kit:ui-reviewer` agent with: the screen ids, reference paths, capture paths, comparison
sheets, the screen's row in screens.md, DESIGN.md, and the design-quality rule
(`.claude/rules/kit/design-quality.md`). It returns fidelity differences by severity (blocker, major, minor) and a
quality critique: the design-quality "Avoid" items it sees and what a senior designer would change. Without a
reference image, the critique against DESIGN.md, the chosen direction, and
`${CLAUDE_PLUGIN_ROOT}/skills/design-intake/patterns.md` is the review.
The reviewer didn't write the UI, which is the point; don't review your own screenshots instead.

## 3. Automated checks
- axe: the capture run and the visual tests fail on any WCAG 2.x A or AA violation.
- impeccable, when installed: `npx impeccable detect --json <app source dir>` (exit 2 means findings) and
  `/impeccable audit` for accessibility, performance, and responsive issues; `/impeccable critique` for hierarchy and clarity.
- Tokens: search the changed UI files for raw hex, rgb, or pixel values that should be tokens.

## 4. Fix and repeat
Fix blockers and majors from both the fidelity review and the critique, recapture, and review again, at most three rounds. Anything the reference doesn't
specify, or a difference you believe is intentional, goes to the user as a question rather than a silent choice.

## 5. Lock it in
- At production rigor (CLAUDE.md §2), when the user accepts the screen, update visual baselines inside the official Playwright Docker image so they
  match CI (the e2e app's `npm run test:visual:update` script does this), and commit the `*-snapshots/` folders.
- Record the result in the task file's **UI verification** line: screens, breakpoints, remaining minor
  differences. screens.md has no status column, so parallel task branches don't conflict on it.
