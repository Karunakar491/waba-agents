---
title: Decisions
tags: [decisions, index, adr]
---

# Decisions

Every architectural and product decision with date and rationale.

## Stack Decisions
- [[stack-backend|Backend Stack]] — Java 21, Spring Boot 3, MySQL only, RestClient
- [[stack-frontend|Frontend Stack]] — Shadcn/ui + Tailwind (Ant Design rejected)
- [[maker-checker|Maker-Checker Process]] — PM + EM + EL gates, no self-approval

## Architecture Decisions
- [[mysql-only|MySQL Only for Analytics]] — ClickHouse dropped (cost + ops complexity)
- [[meta-ai-native|Meta Runs AI Natively]] — we are config layer, not AI layer
- [[jwt-cookies|JWT in httpOnly Cookie]] — RS256, SameSite=Strict, 15min expiry
- [[tsid|TSID for IDs]] — time-sorted BIGINT, NODE_ID env var

## Product Decisions
- [[product-scope|Product Scope]] — Karix BSP existing clients, not new Meta onboarding
- [[wizard|5-Step Wizard]] — live preview, <3min time-to-first-value

## Frontend Design Decisions
- [[design-evaluator-anti-patterns|Design Evaluator Anti-Patterns]] — accumulated list of generic-AI-feel tells to avoid proactively (gradient-sparkle avatars, icon-per-chip rows, pill-badge status indicators)

## 2026-09-07
- [[postman-shaped-connectors-2026-09-07|Connectors Laid Out Like Postman]] — both levels tabbed to Postman's own two levels because operators already know it; collection-level Headers/Body deliberately NOT copied (Meta's connector object has neither, and the merge would be ours); an action's Authorization tab reports its inheritance rather than editing, since Meta forbids per-tool auth; Variables surfaces Meta's three closed macros, previously visible only inside a fill dropdown

## 2026-08-13
- [[reusable-library-over-meta-execution-2026-08-13|Reusable Library Over Meta Execution]] — Meta is the execution layer, our DB is the source of truth for reusable Skills/Connectors/(eventually) Agents; extends the existing Skill pattern to Connectors (library definition / deployed instance / live-state cache, kept as 3 distinct layers)
- [[draft-publish-pattern-audit-2026-08-13|Draft/Publish Pattern Audit Across Agent Detail Tabs]] — audited all 6 tabs against the founder's per-tab draft+publish ask; Business Persona already fully implements it (built same session); Settings is the real gap; Skills/Connectors already have their own library-attach pattern and need a founder decision, not new code; Evals/Events need their data model read first. No-go on new code this pass — scoped follow-up plan written instead of a rushed/incomplete build
- [[draft-publish-settings-and-audience-shipped-2026-08-13|Draft/Publish Shipped for Settings + Audience]] — follow-up same day: shared `useDraftPublish` hook shipped for real, wired into the Audience toggle and the Settings form's draft indicator/Publish button; no backend/migration change needed (existing endpoints already correct, only the timing changed); Skills/Connectors/Evals/Events/FAQ/Websites/Files remain explicitly out of scope
- [[indiamart-buyer-discovery-agent-2026-08-13|IndiaMART Buyer Discovery Agent]] — real client use case, built and live-tested end to end (intent extraction, clarification, context/follow-up, honest no-fake-data behavior); 2 connector definitions caught as unverified placeholders and fixed before shipping, Google Sheets connector built for real
- [[eight-critical-internal-feedback-items-2026-08-13|Eight Critical Internal-Feedback Items]] — webhook logging (all kinds, not just attributable), API Calls + Webhooks filters (phone/agent id), post-login redirect, Conversations show which business number was messaged, Agents list column fixes, Skills/Connectors publish-label honesty pass, Evals/Events confirmed out of scope for draft/publish
- [[debug-section-2026-08-13|Debug Nav Section]] — API Calls + Webhooks moved out of Reports into a new Debug section (mirrors Template Studio's existing /templates/debug precedent); Webhooks shared as one component between Inbox and Debug, not duplicated
