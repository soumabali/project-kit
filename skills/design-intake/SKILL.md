---
name: design-intake
description: Turn design sources (a DESIGN.md, an HTML template or theme, JPG/PNG mockups or screenshots, Figma, a brand guide, or a live site) into a linted Google-format DESIGN.md, exported tokens, and a screen inventory. Use before building or restyling any UI.
argument-hint: "[path or URL of the design source]"
---

# /project-kit:design-intake $ARGUMENTS

Outcome: `DESIGN.md` (tokens and rules), `06-technical-docs/design/screens.md` (every screen, its states, and its
reference), reference images in `06-technical-docs/design/references/`, and tokens wired into each UI app.
Design decisions belong to the user: mark anything you inferred as **inferred** and get it confirmed.

## 1. Identify the source and read its procedure
Read `${CLAUDE_PLUGIN_ROOT}/skills/design-intake/sources.md` and follow the section for each source the project has:
DESIGN.md · HTML template or theme · images (mockups, theme screenshots, PDFs) · Figma · brand guide · live site · nothing yet.
The helper scripts it mentions live in `${CLAUDE_PLUGIN_ROOT}/scripts/`.

## 2. Write DESIGN.md
- Start from `.claude/templates/design.md` (Google DESIGN.md format, alpha). Keep the section order: Overview,
  Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts.
- Tokens: semantic names (`primary`, `on-primary`, `surface`, `on-surface`, `error`, …), a typography scale
  (`headline-*`, `body-*`, `label-*`), `rounded`, `spacing`, and components with `{path.to.token}` references.
- Layout lists the breakpoints the screens must work at (default 390, 768, 1440) and the content max width.
- Lint until clean: `npx @google/design.md lint DESIGN.md`. Fix every error; fix or justify every warning (contrast
  warnings are fixed, not justified).
- If impeccable is installed and PRODUCT.md is missing, run `/impeccable init` so its product context matches the PRD.

## 3. Export tokens into each UI app
- Tailwind v4: `npx @google/design.md export DESIGN.md --format css-tailwind` into the app's theme CSS.
- Tailwind v3: `--format json-tailwind` into `theme.extend`.
- Plain CSS, Blade, ERB, Razor, Vue without Tailwind: `--format css-vars`.
- Flutter, Style Dictionary, or anything else: `--format dtcg`, then generate `ThemeData` and `ThemeExtension`
  classes from it (a small script committed to the app, rerun whenever DESIGN.md changes).
- Never edit generated token files by hand; change DESIGN.md and re-export.

## 4. Inventory the screens
- Copy `.claude/templates/screens.md` to `06-technical-docs/design/screens.md`. One row per screen: id, route,
  purpose, states, auth, reference image.
- For each screen, list the states the source doesn't show (loading, empty, error) and design them from DESIGN.md;
  mark them inferred for the user to review.
- Mirror the list in the e2e app's `screens.ts` (see `/project-kit:e2e`) so verification covers every screen.

## 5. Confirm and record
Show the user a summary: palette with contrast results, type scale, spacing, components, screens, and every
inferred decision. Record their answers in DESIGN.md. Later token changes need approval (CLAUDE.md §5) and a
diff from the committed version (before, then after):
`git show HEAD:DESIGN.md > /tmp/DESIGN.before.md && npx @google/design.md diff /tmp/DESIGN.before.md DESIGN.md --format text`.
