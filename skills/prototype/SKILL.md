---
name: prototype
description: Build a clickable HTML prototype of a feature's main user flows from the PRD and DESIGN.md, before any backend or app code, so the user can walk through it and correct the plan cheaply. Use after a PRD with UI is drafted and before the phase contract and tasks are written, or when the user wants to see how a feature would work.
argument-hint: "[PRD path or feature name]"
---

# /project-kit:prototype $ARGUMENTS

Goal: the user clicks through the feature as their users will and says "yes, that" or "no, this" before anything
is built. Changing a prototype costs minutes; changing built screens costs days.

## 1. Inputs
- The PRD's user stories, flows, and screens; `06-technical-docs/glossary.md` for the words on screen.
- DESIGN.md. If it is still marked `UNCHOSEN`, run `/project-kit:design-intake` first: the prototype shows the
  chosen direction, and is the cheapest place to see it on real screens.
- Sample data from the client (or realistic seed data for the locale and domain, marked as invented).

## 2. Build
- Plain static files in `06-technical-docs/design/prototype/`: one `index.html` listing the flows, one HTML file per
  screen and state, one shared CSS file generated from DESIGN.md's tokens (`npx @google/design.md export DESIGN.md
  --format css-vars`), and as little JavaScript as possible (tabs, dialogs, fake form submits). No framework, no
  build step, no network calls, so it opens from the file system and anyone can review it.
- Cover each flow's happy path, its most likely failure (validation error, empty result, no permission), and the
  loading and empty states of each screen. Link the screens so a flow can be clicked end to end.
- Follow the ui-ux and design-quality rules: real content, the component patterns the app will use, every breakpoint
  in DESIGN.md. It is a prototype of the product, not a sketch, so the user judges the real thing.
- Mark anything you invented (copy, a flow step, a field) with a small "assumption" badge.

## 3. Review with the user
- Give the user the path to `index.html` and the list of assumptions. Ask them to walk each flow and name what's
  wrong, missing, or unclear. In `auto` autonomy, finish the prototype, set the phase's next step to the review,
  and list the assumptions in STATUS.md.
- Apply their corrections to the prototype, and to the PRD (stories, criteria), `screens.md`, and the glossary.
  Repeat until they accept it.

## 4. Hand over
- Screenshots of each accepted screen go to `06-technical-docs/design/references/` (the e2e app's capture spec, or
  a Playwright one-off) and become the references `/project-kit:ui-verify` compares against.
- The phase's Contract names the prototype. Build tasks implement it; a task that departs from it says so in its plan.
- Commit `docs(<feature>): prototype v<n>`.
