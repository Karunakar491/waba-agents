---
title: Karix Brand Guidelines
tags: [frontend, brand, design]
---

# Karix Brand Guidelines

> Use original Karix logo only. Never generate a custom one.

## Colors

| Role | Hex | Tailwind token | HSL (CSS var) |
|---|---|---|---|
| Primary — Navy | `#160E7A` | `brand-navy` | `244 80% 27%` |
| Accent — Pink | `#E73590` | `brand-pink` | `327 79% 55%` (light) · `327 60% 45%` (dark) |
| Success — Green | `#1EBA5D` | `brand-green` | — |
| Body text | `#1F1F1F` | `brand-dark` | `222 13% 13%` |

**Shadcn token mapping:**
- `--primary` → Navy `#160E7A`
- `--accent` → Pink `#E73590`
- `--ring` → Navy (focus rings match brand)

## Typography

| Role | Font |
|---|---|
| All text | **Inter** (Google Fonts) |
| Weights used | 400 (body) · 500 (labels) · 600 (headings) · 700 (display) |

## Logos

| Variant | Use when | URL |
|---|---|---|
| Color logo | On white / light backgrounds | `https://cdn.prod.website-files.com/68c6698e3517c4af35b889cf/68d7ffbf57a30452b2cc4b59_Karix%20logo.webp` |
| White logo | On navy / dark backgrounds | `https://cdn.prod.website-files.com/68c6698e3517c4af35b889cf/68d8019bf5fa5f83c9defd4d_Karix%20white%20logo.webp` |

Logo is wordmark: "karix" in navy with a single hot-pink dot above the "i".

## Design Style
- Modern enterprise SaaS — clean, minimal, high-contrast
- Heavy white space
- Navy + Pink two-tone system
- No loud gradients on primary surfaces
- Card-based layouts, light surfaces
- CTAs: filled or outlined with pink `#E73590`
- Icons: outlined/stroke in navy, accent details in pink
- Shadows: minimal — slight elevation on cards only
- Border radius: `0.5rem` default (Shadcn `--radius`)
