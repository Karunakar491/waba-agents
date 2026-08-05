---
title: Design Evaluator — Generic-AI-Feel Anti-Patterns
tags: [decisions, frontend, design-evaluator]
date: 2026-08-04
---

# Design Evaluator — Accumulated Anti-Pattern List

The Design Evaluator gate (5th gate, runs after UX APPROVE, BLOCKs only on "does this look/feel like a generic AI-generated app") has caught the same handful of patterns repeatedly. Recording them here so future frontend work avoids them proactively instead of getting BLOCKed and fixing after the fact.

## Confirmed anti-patterns (all BLOCKed at least once)

1. **Gradient-circle avatar with a sparkle/star icon** as an AI assistant's identity mark. The single most recycled visual cliché in AI products right now — every Copilot/GPT-wrapper SaaS has this exact icon-in-gradient-circle. If an assistant needs an identity in the UI, use restrained typography or an asymmetric layout signal (e.g. plain-prose replies vs. a bubble for the human) instead of an icon.

2. **Icon-per-item in a starter-prompt / suggestion-chip row.** Structurally identical to ChatGPT/Copilot's "starter prompt" pattern. Plain underlined text links (or a simple bordered pill with NO icon) read as more custom.

3. **Icon-per-row in a list of otherwise-identical items** (e.g. a chat-history sidebar with a `MessageSquare` icon on every row) — every row already reads as "a chat" via position/context; the icon adds visual noise without adding information. Let typography and position carry it.

4. **Pill/badge status indicators for states that could be plain text** (e.g. "● Connected — provider/model" as a green dot + pill). Reads as generic SaaS dashboard chrome (Vercel deployment badges, every "live" indicator) — bleeds dashboard-widget language into a conversational surface. A plain muted text line ("Using {provider}/{model} · Change") reads as information, not a status widget.

5. **Centered-card-with-icon syndrome** generally — the default Shadcn/Tailwind treatment for any "connect X" or empty state. Give it a left accent bar, an asymmetric layout, or drop the icon entirely in favor of a typographic hierarchy that's specific to the product, not swappable into any other SaaS app.

## What consistently PASSED
- Split-pane live preview (chat + a real rendering of the actual output, e.g. a WhatsApp message bubble) — genuinely product-specific, not a templated pattern.
- Asymmetric message treatment: one side gets a filled bubble, the other renders as plain prose with no container — this IS Claude.ai's actual mechanic, and it reads as deliberate rather than incomplete once the rest of the page commits to it.
- A small uppercase tracking-wide label (e.g. "Recent", "Live preview") reusing an existing typographic pattern already established elsewhere on the same page — ties new UI back to the page's own system instead of reading as bolted-on.

## How to Use This List
Before writing new chat-UI or AI-assistant-adjacent frontend code, check the artifact against items 1-5 BEFORE the UX/Design Evaluator gates run. It won't catch everything (the gate exists because taste needs a real review, not a checklist), but it removes the repeat offenders.

See [[../sessions/session-2026-08-04|session-2026-08-04]] for the specific redesign rounds these were caught in.
