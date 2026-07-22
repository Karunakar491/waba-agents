---
title: Frontend Stack Decision
tags: [decisions, frontend, stack]
date: 2026-07-20
---

# Frontend Stack — Shadcn/ui + Tailwind

## Decision
Replace Ant Design 5.x with **Shadcn/ui + Tailwind CSS 3.x**

## Why Rejected Ant Design
- Looks "generic/AI-generated" out of the box
- No design differentiation — every Ant Design dashboard looks the same
- Not appropriate for a branded Karix BSP product

## Why Shadcn/ui
- Full design control — no library fingerprint
- Components are **copied into `src/components/ui/`** and owned by the project
- Built on Radix UI (headless, accessible primitives)
- MIT license — no enterprise/paid tier concerns
- Modern look, used by top-tier SaaS products

## Approved Stack

| Tool | Version | Purpose |
|---|---|---|
| Tailwind CSS | 3.x | All styling |
| Shadcn/ui | — | Component source (owns `src/components/ui/`) |
| Radix UI | — | Headless primitives (via Shadcn) |
| React Hook Form | 7.x | Form state + validation |
| Zod | — | Schema validation |
| lucide-react | — | Icons |
| clsx + tailwind-merge | — | Class utilities via `cn()` |

## Forbidden
- Ant Design — rejected
- Redux / Redux Toolkit — Zustand is sufficient
- `any` in TypeScript

## Scaffolded At
`D:/Meta business agents/frontend/` — Vite + React 18 + TS5

## Shadcn CLI Note
**Do not use `npx shadcn init`** — CLI is unreliable with newer versions.
Always do manual setup: write `components.json`, `index.css` (CSS variables), `src/lib/utils.ts` directly.

## Gates
- PM APPROVED 2026-07-20
- EM APPROVED 2026-07-20
- EL APPROVED 2026-07-20 (after fix: dark mode `--accent` was broken — `327 60% 45%`)
