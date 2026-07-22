---
title: Frontend
tags: [frontend, index]
---

# Frontend

## Pages
- [[brand|Karix Brand Guidelines]] — colors, fonts, logos, design style
- [[stack|Stack & Config]] — Vite, Tailwind, Shadcn, all config files
- [[screens|P0 Screens]] — 9 screens to build, acceptance criteria
- [[components|Component Library]] — Shadcn components added so far
- [[api-client|API Client]] — Axios wrapper, TanStack Query hooks

## P0 Screens (9 total)
1. Sign Up
2. Login
3. Dashboard
4. Wizard Step 1 — Agent name + channel
5. Wizard Step 2 — WABA connect
6. Wizard Step 3 — Knowledge (FAQ, files, websites)
7. Wizard Step 4 — Skills + system prompt
8. Wizard Step 5 — Review + deploy
9. Agent Detail

**Time-to-first-value target:** < 3 minutes (signup → agent live)

## PM Acceptance Criteria (all screens)
- Wizard must have explicit step indicator
- Per-field validation states on all forms
- Loading / success / error feedback on every async action
- Non-technical user must reach agent-live without support
