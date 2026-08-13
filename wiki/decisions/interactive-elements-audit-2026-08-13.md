---
title: Interactive Elements Audit + Build — 2026-08-13
tags: [decision, ui-skills, carousel, cta, interactive, indiamart]
date: 2026-08-13
---

# Interactive Elements Audit + Build

## The ask
Founder wanted "Interactive elements: Buttons, QR codes, Call CTA, Forms, Carousels" tested/proven on a real agent, willing to extend the IndiaMART use case (more sheet columns) to make the demo real.

## Audit findings (what Meta's UI Skills API actually supports)
Per `docs/meta-api/ui-skills.md`, `component_type` is one of: `carousel_quick_reply`, `carousel_url`, `cta_url`, `flow`, `image`, `interactive_list`, `location`, `location_request`. Mapped against the founder's list:

- **List** → `interactive_list` — already built and live (IndiaMART's `supplier-results-list`, prior session).
- **Carousel** → `carousel_quick_reply` — built and verified live this session (see below).
- **Call CTA / Buttons** → `cta_url` — built and verified live this session (see below).
- **Forms** → Meta's `flow` type. This is NOT a UI-skill-only feature — it requires building an actual WhatsApp Flow (separate Flow JSON + Flow API object) before a `flow`-type UI skill can even be enabled ("Flow skills cannot be enabled unless the corresponding flow is published" per the doc). Explicitly deferred — founder chose "Carousel + CTA only for now" when asked.
- **QR codes** — not a BizAI/agent response capability at all. It's WhatsApp Business's own static/dynamic QR deep-link feature (a link to the business's number), unrelated to what an agent sends in a reply. Flagged as a likely terminology mismatch rather than a missing feature.

## What shipped
Two new UI skills created live on the IndiaMART Buyer Discovery Agent via the app's own API (`POST /agents/{id}/ui-skills`), both returned a real `metaUiSkillId`:
- **`supplier-results-carousel`** (`carousel_quick_reply`, enabled) — one card per supplier when 2+ results match, for the buyer to swipe through.
- **`contact-supplier-cta`** (`cta_url`, enabled) — a Call button once the buyer has picked/shown interest in one supplier.

Also corrected a stale code comment in `AgentService.java` ("no live call made yet") — the UI Skills endpoint is now confirmed working for 3 of its 4 practically-usable component types (list, carousel, CTA).

## Explicit follow-up, not yet done
- Founder is adding `Price` and `Phone` (and optionally `Website`) columns to the real Google Sheet backing the Supplier Search connector, so the carousel/CTA have real data to render (price in the carousel card, phone number for the CTA's `tel:` link). Once confirmed, the next step is updating the Apps Script response shape awareness in the `get_supplier_sheet` tool description and the `supplier-search-and-pricing-lookup`/`rank-and-summarize-results` skills to reference the new fields, then a live retest.
- Forms (`flow`) and QR codes remain explicitly out of scope for this pass.

## Related
- [[connector-creation-never-succeeds-2026-08-13|Connector Creation Never Succeeds Against Real Meta]] — the same-day connector/tool work this builds on
- [[indiamart-buyer-discovery-agent-2026-08-13|IndiaMART Buyer Discovery Agent]]
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
