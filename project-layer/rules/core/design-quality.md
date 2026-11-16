---
paths:
  - "**/*.{tsx,jsx,vue,svelte,astro,html,css,scss,erb,cshtml,razor}"
  - "**/*.blade.php"
  - "**/lib/**/{screens,widgets,pages,views,ui,theme,components}/**/*.dart"
  - "DESIGN.md"
  - "PRODUCT.md"
  - "06-technical-docs/design/**/*"
---

# Design Quality

The ui-ux rule says what every screen must do. This one is about taste: work that looks designed for this
product and its users, not like the average of every generated app.

## Before building a screen
- DESIGN.md must be a chosen direction. One still marked `UNCHOSEN` (the kit's starter) is not a design: stop and
  run `/project-kit:design-intake`, which shows directions for the user to pick from.
- Know the screen's one job and its main user: what they came to do, what they look at first, what they do next.
  The layout serves that order; everything else is secondary and looks it.
- Build with realistic content for the locale and the domain: real-length names and addresses, the local
  currency and date format, long titles, a 300-row table, an empty state, an error from the real API. Ask for the
  client's sample data when the PRD has none; otherwise write seed data that looks like theirs.
- Reuse the project's component base (DESIGN.md names it) and its existing screens' patterns before inventing new
  ones; `/project-kit:design-intake` keeps patterns for common screen types.

## Avoid (the generated look)
- A purple, indigo, or blue-to-violet gradient as the identity; gradient text; glassmorphism without a reason.
- The template landing page: centered hero, a "Get started" button, three feature cards with icons, a testimonial
  row, a pricing grid. Use it only when the brief truly is that page.
- Every block in a rounded card with a soft shadow; cards inside cards; equal visual weight everywhere.
- Emoji as icons, mixed icon sets, or an icon on every label. One icon family, used where it aids scanning.
- Generic copy: "Welcome back!", "Unlock the power of…", "Seamless", "Effortless", "Lorem ipsum", "John Doe".
- Default type with no scale (everything 14–16 px), centered body text, long lines (over about 75 characters).
- Decoration that carries no information: blobs, floating shapes, stock 3D illustrations, confetti.
- Dashboards of identical stat tiles with green and red arrows that say nothing about what to do.

## Aim for
- Hierarchy you can see squinting: one primary action per view, a clear headline, quieter secondary content.
- A type scale with contrast (size and weight steps from DESIGN.md), tabular numbers in tables and figures.
- Density that fits the user: admins and operators get compact tables, filters, bulk actions, and keyboard
  paths; occasional users get fewer choices per screen and plain language.
- Spacing from the scale, with related items closer than unrelated ones; alignment to a grid.
- Color used sparingly for meaning (primary action, status, focus), with neutrals carrying most of the screen.
- Copy in the user's language and the glossary's terms; labels that name the thing, buttons that name the action.
- Motion only for feedback and continuity (under 300 ms), never to decorate.

## Check before calling a screen done
Compare it with its reference or, without one, with the direction the user picked, at every breakpoint. Then
ask of each screen: would a senior product designer ship this for this client? Name what fails and fix it.
`/project-kit:ui-verify` runs this check through the ui-reviewer agent.
