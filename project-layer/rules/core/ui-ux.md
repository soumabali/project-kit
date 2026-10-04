---
paths:
  - "**/*.{tsx,jsx,vue,svelte,astro,html,css,scss,erb,cshtml,razor}"
  - "**/*.blade.php"
  - "**/lib/**/{screens,widgets,pages,views,ui,theme,components}/**/*.dart"
  - "DESIGN.md"
  - "PRODUCT.md"
  - "06-technical-docs/design/**/*"
---

# UI and UX Rules

## Source of truth
- `DESIGN.md` (Google DESIGN.md format) holds every token and visual rule; `06-technical-docs/design/screens.md`
  lists every screen with its states, breakpoints, and reference image. Read both before building or changing UI.
- Use tokens only: no raw hex or rgb, no ad-hoc font sizes, spacing, radii, or shadows in components. If a token is
  missing, propose a DESIGN.md change (it needs approval); never invent a style.
- After editing DESIGN.md, run `npx @google/design.md lint DESIGN.md` and re-export tokens
  (`npx @google/design.md export DESIGN.md --format css-tailwind|json-tailwind|css-vars|dtcg`).
- impeccable keeps product context in PRODUCT.md and may write DESIGN.md; keep DESIGN.md in Google's format and lint it after.

## Every screen
- Builds all its states: loading (a skeleton shaped like the content), empty (with the next action), error (what
  happened and how to recover), success, and partial or offline where relevant.
- Works at every breakpoint in DESIGN.md (default 390, 768, 1440 px) with no horizontal scroll, and reflows at
  320 px wide and at 200% zoom.
- Copy is specific: buttons say what they do, errors say how to fix them, no placeholder text ships.

## Interaction
- Respond to input within 100 ms (pressed state); show progress for anything over about 300 ms.
- Destructive actions confirm or offer undo. Never lose what the user typed on an error or navigation.
- Forms: a visible label per field, validation on blur and on submit, server errors shown next to their field.
- Motion follows DESIGN.md, stays under 300 ms for UI transitions, and respects `prefers-reduced-motion`.

## Accessibility (WCAG 2.2 AA)
- Semantic elements first, ARIA only to fill gaps. Every control is reachable by keyboard with a visible focus
  indicator; focus moves into dialogs and back out when they close.
- Contrast at least 4.5:1 for text and 3:1 for large text and controls. Never use color alone to carry meaning.
- Targets at least 24×24 CSS px (44 px for primary actions; 48 dp in Flutter). Informative images get alt text,
  decorative ones get empty alt.
- Flutter: `Semantics` labels on custom widgets, and layouts survive large text scaling.

## Language and locale (when the Profile or PRD lists more than one locale)
- Every user-facing string comes from translation files (Laravel `lang/`, the framework's i18n library, Flutter
  ARB); never concatenate translated fragments, use placeholders and plural rules instead.
- Format dates, times, numbers, and currency for the user's locale (`Intl`, Carbon, `intl`), and store times in UTC.
- Layouts survive text about 30% longer than English; set `lang` (and `dir` for right-to-left) on the page.

## Client-side safety
- Anything shipped to a browser or app binary is public. Public env prefixes (`NEXT_PUBLIC_`, `NUXT_PUBLIC_`,
  `VITE_`, `EXPO_PUBLIC_`) are for public values only.
- No raw HTML injection (`dangerouslySetInnerHTML`, `v-html`, `{!! !!}`, `Html.Raw`, `raw`) with user content unless
  an allowlist sanitizer cleans it first.
- Web auth tokens live in HttpOnly cookies, never `localStorage`.

## Verify
- New or changed screens pass `/project-kit:ui-verify`: screenshots at each breakpoint compared with the reference,
  no axe violations, and visual baselines committed.
- Performance: size and lazy-load images, subset fonts with `font-display: swap`, and prevent layout shift from
  late-loading content.
