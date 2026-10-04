# Screens

The inventory of every screen, kept in step with the E2E screen list (`07-application/e2e/screens.ts`).
Each screen is built with all its states and verified at every breakpoint with `/project-kit:ui-verify`.

Breakpoints: mobile 390×844 · tablet 768×1024 · desktop 1440×900 (override in DESIGN.md → Layout).

| Id | Route | Purpose | States | Auth | Reference |
|---|---|---|---|---|---|
| home | `/` | | loading, empty, error, success | public | `references/home-desktop.png` |

Whether a screen is verified lives in the task that built or changed it (its **UI verification** line), so task
branches never edit this table.

## Notes per screen
### home
- Components: …
- Data: …
- Open questions for the designer: …
