---
version: alpha
name: Product Design System
description: Starter tokens. Replace every value with the real ones from the design source, then lint.
colors:
  primary: "#1F4FD8"
  primary-hover: "#1A43B8"
  on-primary: "#FFFFFF"
  secondary: "#475467"
  neutral: "#F8FAFC"
  surface: "#FFFFFF"
  on-surface: "#101828"
  muted: "#667085"
  border: "#D0D5DD"
  border-strong: "#858D9D"
  error: "#B42318"
  success: "#067647"
  warning: "#B54708"
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  input-border:
    backgroundColor: "{colors.border-strong}"
    width: 1px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
  helper-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  alert-error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
  alert-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
  alert-warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
---

# Product Design System

## Overview
Describe the personality in two or three sentences: who uses the product, how it should feel (calm or
energetic, dense or spacious, playful or formal), and what it must never feel like.

## Colors
- **Primary (#1F4FD8):** the one color for primary actions and links. One primary button per view.
- **Secondary (#475467):** supporting text and secondary actions.
- **Neutral (#F8FAFC) and Surface (#FFFFFF):** page background and raised surfaces.
- **On-surface (#101828) and Muted (#667085):** body text and helper text.
- **Border (#D0D5DD):** dividers and card edges. **Border-strong (#858D9D):** outlines of inputs and other controls,
  which need 3:1 contrast against surface and neutral.
- **Error, Success, Warning:** status only, always paired with an icon or text, never color alone.

## Typography
Inter for everything. Headlines semibold to bold with slightly tight tracking; body at 16px with 1.6 line
height for reading comfort; labels medium weight. Weights: 400 body, 500 labels, 600 to 700 headlines; no others.

## Layout
Mobile-first. Breakpoints: 390px (mobile), 768px (tablet), 1440px (desktop); content max width 1200px.
Spacing follows a 4px base with an 8px rhythm (xs to xxl). Page margin 16px on mobile, 24px gutters on grids.

## Elevation & Depth
Mostly flat: separate layers with the border color and surface contrast. Shadows only for overlays such as
menus, popovers, and dialogs.

## Shapes
8px corners for controls and inputs, 12px for cards, full rounding only for pills and avatars.

## Components
- **Buttons:** 44px tall, 12px padding, label-md type; hover darkens to primary-hover; visible focus ring.
- **Inputs:** 44px tall with a 1px border-strong outline, a visible label above, and helper or error text below; the
  error state uses the error color plus a message.
- **Cards:** surface background, 24px padding, 12px corners.

## Do's and Don'ts
- Do use tokens for every color, size, radius, and space; never hard-code values in components.
- Do design loading, empty, error, and success states for every screen.
- Do keep text contrast at 4.5:1 or more, and 3:1 for large text and controls.
- Don't use more than one primary button in a view.
- Don't convey meaning with color alone.
