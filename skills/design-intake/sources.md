# Design sources

Follow the section for each source. When two sources disagree (for example a theme and a brand guide), ask which wins.

## An existing DESIGN.md
- Google format (YAML front matter with `colors`, `typography`, …): lint it and fix errors; keep the user's prose.
- Another format (impeccable's, a hand-written style guide): convert the values into Google-format front matter,
  keep the prose under the matching sections, lint, and show the user the diff.

## An HTML template or theme (ThemeForest-style, a static mockup, an old site)
1. Check the license: the use must be allowed (single product versus SaaS, attribution needs). Note it in an ADR.
2. Inventory the CSS objectively:
   `node "<plugin>/scripts/css-inventory.mjs" <template-folder>`
   It ranks colors, font families, font sizes, radii, shadows, spacing values, and media-query breakpoints by use.
   Map the frequent values to tokens; treat one-off values as noise unless they're on a key component.
3. List pages and components (header, cards, forms, tables, modals) and map pages to screens.
4. Capture each page as a reference image at each breakpoint (Playwright `page.screenshot({ fullPage: true })`
   against a local static server) into `06-technical-docs/design/references/<screen>-<width>.png`.
5. Port markup into the target framework's components; never ship the template's bundle wholesale. Drop jQuery
   plugins you don't need, trackers, demo content, and unpinned CDN scripts.

## Images (JPG or PNG mockups, theme screenshots, exported PDF pages)
1. Copy them into `06-technical-docs/design/references/` named `<screen>-<width>.png`. Ask for the intended
   viewport width if the image size doesn't make it obvious.
2. Look at every image yourself. Then extract exact colors instead of guessing:
   `python3 "<plugin>/scripts/palette.py" <image> --colors 12` (needs Pillow: `pip install pillow`).
   Map the dominant colors to roles (background, surface, text, primary action, borders, status).
3. Measure spacing and sizes in pixels against the image width (an image 1440px wide at 1x means 1px = 1 CSS px;
   halve values for 2x exports). Snap to a 4px or 8px scale and record the scale.
4. Typography: name candidate families from the letterforms, but confirm the font with the user and check its
   license; never guess silently. Record sizes, weights, and line heights per text style.
5. Components and states: list every component visible, then the states the images don't show.

## Figma
If a Figma connector or MCP server is available, read variables, styles, and components through it and export
frames as reference PNGs. Otherwise ask the user for exported frames at 1x and the variables as JSON.

## A brand guide (PDF or deck)
Take logo usage, brand colors, and fonts from it; check that brand colors meet contrast for text and controls,
and propose accessible variants (for example a darker `primary` for text on white) for the user to approve.

## A live site (redesign or a site to match)
Screenshot it with Playwright at each breakpoint and read computed styles of key elements
(`getComputedStyle` via `page.evaluate`) to extract real values. Only for sites the user owns or has rights to.

## Nothing yet
Draft DESIGN.md from the PRD and the user's preferences (or, when impeccable is installed, run `/impeccable init`
for PRODUCT.md, then `/impeccable shape`), show two or three directions as rendered screens, and let the user choose before any build work.
