---
title: IndiaMART Buyer Discovery Agent — 2026-08-13
tags: [decision, client-use-case, agents, skills, connectors, indiamart]
date: 2026-08-13
---

# IndiaMART Buyer Discovery Agent (Phase 1: Text Only)

## Source
Real client scoping email (IndiaMART, via Ashutosh) asking whether the Meta Business Agent platform can replicate IndiaMART's buyer-discovery journey for WhatsApp text messages: extract product + location from a message, ask a clarifying question if the product is ambiguous, call IndiaMART's Supplier Search/Pricing APIs, rank and summarize results conversationally, and keep conversation context so follow-up refinements ("show me cheaper suppliers") don't require repeating the product. Founder's framing on top: build it as a real, capable agent — Skills, a UI Skill, and real Connector Library definitions, not a toy.

## What Was Built (all real, live-tested against actual Meta infrastructure)
A new agent, `IndiaMART Buyer Discovery Agent`, deployed on WABA `494227720434920`, phone `+91 91520 04195`:

- **Business Persona** — deployed to Meta: describes the buyer-discovery service, and correctly states that payment/delivery/returns are between buyer and supplier, not IndiaMART or this agent.
- **4 Skills**, each a real Meta skill synced live:
  1. `intent-and-entity-extraction` — pulls product/location/qualifiers per message; reuses earlier product/location on a pure refinement instead of re-asking.
  2. `clarification-on-ambiguous-product` — asks ONE clarifying question with 2-4 concrete sub-type examples for a broad category, never guesses.
  3. `supplier-search-and-pricing-lookup` — calls the (pending) IndiaMART connectors once product+location are unambiguous; explicit instruction to never fabricate a supplier, price, or rating if a connector call fails or returns nothing.
  4. `rank-and-summarize-results` — ranks by location match, then price/rating, summarizes top 3-5 conversationally, invites a refinement.
- **1 UI Skill** (`supplier-results-list`, `interactive_list` component) — presents ranked results as a tappable list rather than a wall of text.
- **3 Connector Library definitions** (`connector-library`, see [[reusable-library-over-meta-execution-2026-08-13|the pattern these are built on]]):
  - `IndiaMART Supplier Search API` and `IndiaMART Pricing API` — created **as honest placeholders**. First draft used an invented-but-plausible-looking base URL and field names from general knowledge of IndiaMART's public CRM/lead-push API convention — caught and corrected immediately once written, because that convention is for sellers pushing leads, not a documented buyer-facing search/pricing API, and presenting an unverified guess as a real endpoint would have violated the same "never fabricate" rule held all session. Both now explicitly marked `TBD-confirm-with-indiamart.example` with a description stating they must not be deployed until the real contract is confirmed.
  - `Google Sheets Export` — built for real. Unlike IndiaMART's buyer-side API, Google Sheets API v4's base URL and OAuth2 client-credentials shape are genuinely well-documented, stable public knowledge, not a guess.

## Live Verification (all 3 sample journeys from the client email, run for real)
1. **"I need TMT Bars in Delhi"** — product+location correctly extracted, search attempted, and because no real IndiaMART connector is deployed yet, the agent said so honestly ("couldn't find any... suppliers") instead of inventing results — direct proof the "never fabricate" skill instruction holds under a real no-data condition, not just in the skill's prose.
2. **"I need pipes"** — asked a clarifying question listing PVC/GI/HDPE/Stainless Steel — near-verbatim match to the client's own example in their email.
3. **"PVC pipes, Mumbai"** (reply to the clarification, same `conversationId`) — correctly resolved as the answer to its own question.
4. **"Show me cheaper suppliers."** (same `conversationId`, no product/location repeated) — correctly referred back to "PVC pipes in Mumbai" from two turns earlier. This is the exact context/session behavior the client's email asked about, working live.

## What's Genuinely Not Done Yet (honest, not silently skipped)
- **No real IndiaMART API integration.** The two IndiaMART connector definitions are placeholders. Real deployment needs the actual Supplier Search and Pricing API contract (base URL, auth scheme, field names) from IndiaMART or the client — this cannot be guessed or fabricated. Once given, deploying is a matter of editing the connector definition and running `POST /connector-library/{id}/deploy` with the real secret.
- **No Google Sheets logging wired to a real sheet yet.** The connector definition is real; a deployment needs a real OAuth client id/secret or service-account key.
- **Image/audio/video message types** — explicitly out of scope for Phase 1 per the client's own email; text only.

## Related
- [[reusable-library-over-meta-execution-2026-08-13|Reusable Library Over Meta Execution]] — the architecture this agent's connectors are built on
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
