# Screen patterns

What good looks like for the screen types client projects keep needing. Use these to design directions, fill gaps a
reference doesn't cover, and judge a screen in `/project-kit:ui-verify`. They describe structure, not style: the
look comes from DESIGN.md.

## Admin and back-office lists (the most common screen)
- Page title with a count, one primary action top right, and search plus the two or three filters people actually
  use, visible; the rest behind "More filters". Active filters show as removable chips.
- A dense table: left-aligned text, right-aligned numbers with tabular figures, dates in the locale's short format,
  status as a small labeled badge (color plus text). Sortable columns where sorting means something.
- Row actions in a trailing menu; bulk actions appear when rows are selected. Clicking a row opens its detail.
- Pagination or "load more" with the total; the URL keeps search, filters, sort, and page, so a view can be shared.
- Empty state says why it's empty and offers the next step (create, clear filters); loading keeps the layout.

## Detail and edit
- The record's name and status in the header, key facts in a summary block, then sections (or tabs only when a
  section is long and independent). History or activity at the bottom or in a side panel.
- Edit in place for one field, a form page or drawer for many. Long forms are grouped with headings, one column,
  labels above fields, and a sticky save bar; the save button names the action ("Save booking").
- Destructive actions are separate from saving, confirm with the record's name, and say what will be lost.

## Dashboards
- Start from the decisions the user makes, not from the data available: three to five numbers that matter, each
  with its comparison (vs. last period or target) and a link to the list behind it.
- One chart per question, labeled directly; no 3D, no pie with more than four slices. Alerts and tasks that need
  action go above the charts.

## Forms people fill once (sign-up, checkout, applications)
- Ask only what's needed now; group into short steps with progress when over about seven fields.
- Inline validation on blur with the fix in the message; keep everything typed after an error.
- The locale's formats: phone with country code, address fields in the local order, currency without decimals
  where the currency has none (IDR).

## Public pages (company sites, product and landing pages)
- The first screen says what it is, for whom, and the one action, in the client's words, with a real photo or
  product image; not a generic hero with three icon cards.
- Proof in specifics: client logos, numbers, short case results, real testimonials with names and roles.
- Content blocks vary in layout with the content; long pages get anchors; contact details and the primary action
  are reachable from every section on mobile.

## Mobile apps
- Bottom tabs for three to five top-level sections; the primary action within thumb reach; native patterns for
  each platform's back, share, and pickers.
- Lists load fast with skeletons, pull to refresh, and offline states that keep what was already loaded.
- Forms use the right keyboard per field, keep the focused input visible above the keyboard, and save drafts.
