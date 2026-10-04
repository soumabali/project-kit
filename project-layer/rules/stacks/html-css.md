---
paths:
  - "{{APP}}/**/*.{html,css,scss,js}"
  - "{{APP}}/package.json"
kit: {"name": "HTML and CSS (static site or template)", "commands": {"setup": "npm install", "dev": "npx serve .", "test": "npx playwright test", "testOne": "npx playwright test -g \"<name>\"", "lint": "npx prettier --check . && npx stylelint \"**/*.{css,scss}\" && npx html-validate \"**/*.html\"", "build": "npm run build", "audit": "npm audit --audit-level=high"}}
---

# Stack: HTML and CSS (static sites and templates)

## Structure
- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, headings in order, valid markup.
- CSS custom properties generated from DESIGN.md (`npx @google/design.md export DESIGN.md --format css-vars`);
  no colors or sizes outside the token file.
- Mobile-first. Flexbox and grid for layout, container queries where components resize on their own, `clamp()`
  for fluid type within the DESIGN.md scale.
- One naming scheme (BEM or utility classes) used consistently; no inline styles; `!important` only in utilities.
- Images set `width` and `height` (or `aspect-ratio`), use `srcset` and `sizes`, AVIF or WebP with a fallback, and
  `loading="lazy"` below the fold. Icons from one SVG set.
- Fonts self-hosted or from an approved CDN with `font-display: swap`; preload only critical weights; licenses confirmed.
- JavaScript is progressive enhancement; no inline event handlers (they break CSP); third-party scripts only with SRI.

## Templates from third parties
- Confirm the license covers this use. Remove trackers, unused plugins, and demo content. Replace CDN scripts with
  pinned versions (bundled or SRI-protected).

## Testing
- Playwright: every page loads with no console errors, internal links resolve, forms submit, axe reports no
  violations, and visual snapshots exist at each breakpoint.
- Lighthouse CI budgets for performance, accessibility, best practices, and SEO on key pages.

## Quality gates
- Prettier, Stylelint (with `declaration-strict-value` to enforce tokens), html-validate, and a link checker.
