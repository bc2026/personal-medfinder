---
name: Personal Medfinder
description: Self-hosted pharmacy outreach UI — warm neutral surfaces, deep green accent, editorial display type.
colors:
  surface: "#f5f0e8"
  surface-elevated: "#fffcf7"
  ink: "#1a2e28"
  muted: "#5c6b65"
  accent: "#1b6b5a"
  accent-hover: "#145246"
  accent-soft: "#d8ebe6"
  border: "#d4cfc4"
  border-strong: "#b8b0a2"
  warning-bg: "#faf3e4"
  warning-border: "#c9a227"
  danger: "#9b2c2c"
  danger-bg: "#fceeed"
  on-accent: "#fffcf7"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  page-title:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  btn-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  btn-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
---

## Overview

Personal Medfinder is a **product** UI: dashboard, session detail, maps, and forms. Visual identity is **restrained**: warm paper-like surfaces (`surface` / `surface-elevated`), deep forest **ink** and **accent** green, and **Fraunces** for display and product name while **Source Sans 3** carries UI and body. Light mode is default; a `.dark` class on `html` swaps to a dark green-night palette using the same token names in `frontend/src/index.css` (`@theme` + `.dark` overrides).

The shell uses a sticky header (`surface-elevated` with blur), max-width content column (~`max-w-5xl`), and utility classes that reference CSS variables (`var(--color-*)`) for all semantic colors.

## Colors

- **Surfaces**: `surface` body background; `surface-elevated` for cards, header, and raised panels. Body may use subtle radial washes and a light noise overlay (low opacity)—identity is warm but not flat white.
- **Text**: `ink` for primary text; `muted` for secondary—verify contrast on `surface` and tinted panels (especially placeholders).
- **Accent**: `accent` for primary actions, active nav, links, and focus rings; `accent-hover` for hover; `accent-soft` for subtle fills and ghost hovers.
- **Borders**: `border` default; `border-strong` when separation needs to read more clearly.
- **Semantic**: `warning-*` for caution/disclaimer callouts; `danger` / `danger-bg` for destructive actions and error tone.
- **Map markers**: Stock pins use saturated fills with white ring/shadow for legibility on the map (see `StockMap.tsx`).

Dark theme mirrors these roles with higher luminance on ink/muted and a brighter `accent` for interactive elements.

## Typography

- **Display / product name**: Fraunces — use `font-display` or the `.font-display` / `.page-title` helpers for headings and branding.
- **UI and body**: Source Sans 3 on `body` via `index.css`.
- **Scale**: Page titles use `.page-title` (responsive `text-3xl` / `text-4xl`). Keep product UI on a **modest type scale** (no oversized fluid heroes); prose uses `.page-lead` for intro copy with capped width (`max-w-xl`).
- **All caps**: Used sparingly (e.g. small header subtitle “Pharmacy outreach”)—not as a repeated section eyebrow pattern.

## Elevation

- **Card shadow**: `--color-shadow` and `--color-shadow-lg` (layered soft shadows using ink at low alpha). `.card` and `.card-interactive` apply `rounded-2xl`, border, and shadow; interactive cards lift slightly on hover (`translateY(-1px)`) and deepen shadow.
- **Header**: `backdrop-blur-md` with semi-opaque `surface-elevated` for separation without heavy chrome.
- **Drawers / overlays**: Voice drawer uses `shadow-xl` and border-left panel pattern; backdrop fades in—keep z-index coherent with map (Leaflet stacking documented in CSS comments).

## Components

Primitives live in `frontend/src/index.css`:

- **`.card`** / **`.card-interactive`** — default and hover-enhanced surfaces.
- **`.input`** — full-width fields with `rounded-xl`, focus ring `ring-2 ring-[accent]`.
- **`.btn`**, **`.btn-primary`**, **`.btn-secondary`**, **`.btn-ghost`** — consistent `rounded-xl`, `text-sm font-semibold`, 200ms transitions.
- **`.segmented`** / **`.segmented-btn`** — pill toggle groups with active state on accent.
- **Links**: `.link-back`, `.link-accent`.
- **Motion**: `.page-enter` (fade-up), `.page-enter-fade`, `.stagger-*` for list reveals; voice drawer keyframes `voice-drawer-in` / `voice-backdrop-in`.

React pieces compose these: `Layout` (nav, theme toggle, logo), `PharmacyCard`, `StockMap`, `DisclaimerBanner`, `VoiceCallViewer`, pages under `src/pages/`.

## Do's and Don'ts

**Do**

- Use CSS variables (`--color-*`, `--font-*`) or Tailwind arbitrary values `bg-[var(--color-surface)]` so light/dark stay in sync.
- Keep primary actions on **accent** with **on-accent** text; maintain visible **focus** states on all interactives.
- Reuse `.btn-*`, `.input`, `.card` before inventing new button or field styles.
- Pair stock/status color with **text or icon** meaning, not color alone.

**Don't**

- Introduce extra display fonts in labels, tables, or dense UI (product register: one sans for UI workload).
- Add layout-affecting decoration animations without a **`prefers-reduced-motion: reduce`** alternative (current codebase: add this when extending motion).
- Rely on low-contrast **muted** for critical instructions or placeholders.
- Use gradient text, decorative glass stacks, or side-stripe “alert” borders as a default pattern for new surfaces.
