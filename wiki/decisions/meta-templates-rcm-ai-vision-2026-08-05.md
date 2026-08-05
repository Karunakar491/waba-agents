---
title: Product Vision — Template Management, Karix RCM & AI-Layer Expansion (2026-08-05)
tags: [decisions, product-vision, ux, meta-api, rcm, iris]
date: 2026-08-05
---

# Product Vision — Templates, RCM, and What Iris Should Configure

Joint PM + UX read of two capability surfaces the prior [[product-vision-meta-capability-surface-2026-08-05]] missed because it only read `docs/meta-api/*.md` — and Template Management + Karix RCM have no doc file there to read. Founder correctly flagged this: a built, working feature (Template Studio) and a second working messaging capability (karix-mcp RCM builders) were never audited like `ui-skills.md`/`agent-event.md` were. This document does that, then makes the acquisition-lens calls the founder asked for. Research-only, no code touched.

## 0. The framing that matters here

Same lens as before: this is an internal ops console, multi-client is the premise, and an Apple/Google diligence reviewer is asking "did the people who built this understand the problem, or did they wrap APIs." Two new facts change the analysis versus the prior doc:

1. **Template Management is not a gap — it's already built, and reasonably well.** `TemplateStudioController.java` covers create/edit/delete/list/get, media upload, bulk import, audit log, and phone-mapping. The question here isn't "should we build templates," it's "what's the real gap between what Meta's Template API supports and what we expose" — a maturity question, not a greenfield one.
2. **Karix RCM is a second, mostly-disconnected messaging capability sitting in the codebase.** `karix-mcp/karix_mcp/builders.py` can send free-form text, media, buttons, list-menus, and CTA-URL messages over the same WABA channel *without* going through Meta's template-approval pipeline — because it isn't a WhatsApp API at all, it's Karix's own RCM layer fronting the send. Only its *template* CRUD path is wired into the Java backend and Iris today. The rest — plain text, buttons, list, CTA-URL — has zero callers anywhere in the backend. It is real, working code that the product does not use.

The acquisition-lens question this raises, stated plainly: **is "a second rich-messaging channel that skips Meta's approval queue" a moat, or is it dead code an acquirer's diligence team flags as unmanaged surface area?** The answer below is: it's a real, narrow opportunity — not the headline bet — and it must not be built as a parallel product.

## 1. Template Management — the real gap, not a new capability

Confirmed via direct code read (no `docs/meta-api/templates.md` exists; the repo's only Postman collection, `Meta Business Agent mdh_spices postman_collection 8 July v2.json`, documents the BizAI agent-config surface — onboarding/skills/connectors/FAQ — and contains **zero** template-management endpoints; anyone using it as "the Meta API reference" would wrongly conclude templates aren't part of this product).

What's actually implemented (`TemplateStudioController.java`, proxied through `TemplateStudioClient.java` to karix-mcp's `rcsgui.karix.solutions/api/v1.0/template/*`, which fronts Meta): create, edit (rate-limited by Meta: 1x/day, 10x/30days on Approved templates — a real constraint the client-layer comment already documents), delete, list with status filter, get single, media upload for header handles, async bulk import with job polling, audit log, phone/esme credential mapping. Frontend (`TemplateStudioPage.tsx`) exposes language, category, header format (NONE/TEXT/IMAGE/VIDEO/DOCUMENT) with media, body, footer, and buttons (QUICK_REPLY/URL/PHONE_NUMBER), plus a read-only `quality_score` display.

**Confirmed gaps** (built feature, missing edges — not a new product):
- **No authentication-category template support** (OTP/one-time-passcode button type). Category field defaults to UTILITY; no evidence of an AUTHENTICATION-specific button flow.
- **No per-language template family management.** A template is single-language; there's no UI concept of "this template in 6 languages, submit/track together," which is how multi-market clients actually operate templates in practice.
- **No pre-approved template library / import-from-Meta-catalog flow.** Everything is authored from scratch.
- **No pacing/messaging-tier visibility** — quality score is shown, but not the throughput-tier consequence of that score (Meta ties template quality to sending limits; an ops person watching a client's agent has no way to see "this account's send volume is capped because of template quality" without leaving the product).

**The call:** these are real, but they are **maturity fixes on an existing surface**, exactly like `connectors.md`'s `/logs` stats gap in the prior audit — ship as normal build tasks against Template Studio, not as a vision-level initiative. None of them individually differentiate this product from a competent WhatsApp BSP console; all of them are things a diligence reviewer expects to already work and would only flag as a *minus* if broken, not treat as a *plus* if present. Authentication-category support is the one item worth prioritizing among these four, because its absence is a hard blocker (a client literally cannot do OTP templates today), not a polish gap.

## 2. Karix RCM — real capability, narrow scope, do not build it as a second product

`builders.py` supports five payload shapes over Karix's RCM `sendMessage` endpoint (channel `"WABA"`): `build_text` (plain text, no template needed), `build_template` (approved template + params — already wired), `build_media`, `build_buttons` (max 3, interactive reply), `build_list` (interactive menu), `build_cta` (CTA-URL button). `karix_client.py` sends these via a non-standard `Authentication: Bearer` header with retry/backoff and full audit logging.

Grep across the Java backend confirms: only the *template* path (`create/edit/delete/list/get/upload_media`, via `TemplateStudioClient`/`KarixMessagingClient`) has a caller. `send_message`/`build_text`/`build_buttons`/`build_list`/`build_cta` have **no backend or frontend caller anywhere.** This is built, tested-looking code with an audit-logging layer around it, sitting unused.

**What it's actually for, stated plainly:** Meta requires an approved template to *initiate* an outbound WhatsApp conversation outside the 24-hour customer-service window. RCM's free-text/buttons/list/CTA builders exist for the same reason `agent-event.md`'s business-event mechanism exists in the prior audit — proactive, ad hoc messaging — but RCM's version doesn't need template approval at all, because it isn't going through Meta's template pipeline; it's Karix's own channel. That makes it functionally a **within-24-hour-window rich-message capability with no approval latency**, which is genuinely useful for one specific case: an agent that's already in an active conversation (inside the 24h session window) wanting to send a button/list/CTA reply without pre-authoring a template for every possible interactive response.

**The call — this is not a second product, and must not be pitched as "multi-channel messaging":**
- It is **not** a fallback channel to SMS/RCS-when-WhatsApp-unavailable, despite the acronym inviting that reading. There's no evidence in `builders.py`/`karix_client.py` of any non-WABA channel — `channel: "WABA"` is hardcoded. Calling this "multi-channel" in a pitch deck would be an overclaim a diligence engineer would catch in one grep.
- The real, narrow, honest pitch: **"in-session rich replies without template pre-authoring."** Today, if an ops person wants their agent to send a button or list menu mid-conversation, they must pre-author and get Meta approval for a template with that exact button/list baked in. RCM's builders let the *agent itself* construct an ad hoc buttons/list/CTA message inside an active session, no approval round-trip. That is a real quality-of-agent-response improvement, not a new channel.
- **Do not build a "Karix RCM" tab, page, or channel selector.** Per §1 of the prior doc's own lesson (UI Skills must not be a bolt-on tab reflecting an API's resource shape) — RCM's buttons/list/CTA/media builders should be absorbed as **additional response formats an agent can use inside an active session**, conceptually adjacent to (not a duplicate of) the rich-message Skills work already proposed in the prior doc's §1. Concretely: the same "Response format" field proposed for Skills (Carousel / CTA / Flow / Image / Interactive list / Location / Request location) is Meta-template/UI-Skills shaped; RCM gives the *in-session, no-approval-needed* version of buttons/list/CTA/media specifically. These are two different delivery mechanisms for overlapping UI shapes, and the product should hide that mechanism distinction from the ops person entirely — they should pick "send a list menu," and the system should decide template-vs-RCM-in-session based on whether the conversation is inside the 24h window, not ask the user to know Karix's plumbing exists.

## 3. Iris (AI layer) — what changes given §1 and §2

`IrisConversationService.java` today has a hard-coded 4-tool allowlist enforced in code, not just prompt: `create_template`, `edit_template`, `list_templates`, `send_test_template` — explicitly scoped to templates only, with all mutating tools requiring a separate confirm-then-execute call (no re-derivation from a fresh model turn — a real safety property worth preserving). It does not touch UI Skills, RCM, connectors, or FAQ.

**Given §2's finding that RCM's in-session builders are unused capability:** the temptation is "make Iris configure RCM messages too." That is the overreach case, and the call here is **no, not yet, and here's the actual test**: Iris's current scope is narrow because its tools map 1:1 onto reviewable, approval-gated, replayable actions (a template create/edit is inspectable before and after; a test send is low-risk and reversible in effect). RCM in-session sends are neither reviewable in advance (they're generated live, mid-conversation, by the agent, not authored ahead of time by an ops person) nor template-shaped (no approval artifact to show a confirm panel for). Iris configuring "when should the agent use a list menu vs. a button vs. plain text" is a **behavior/skill-authoring question**, which belongs in the Skills surface (per the prior doc's response-format field) — not in Iris, which is a template co-pilot, not a general agent-behavior co-pilot. Collapsing those two would re-introduce the exact "one system pretending to be two, or two systems pretending to be one" failure mode both audits keep finding.

**The one real, in-scope expansion:** Iris's `create_template`/`edit_template` tools should be extended to cover the authentication-category gap from §1 (OTP templates) — that's the same conversational surface, same confirm-then-execute safety pattern, just a new template subtype. That is a template-studio maturity fix routed through the existing Iris tool contract, not a new AI capability.

**What should explicitly not happen:** a unified "AI configures ANY outbound rich-message capability, across Meta templates, UI Skills, and Karix RCM" mega-tool. This sounds like leverage in a pitch and is actually the opposite — it collapses three systems with different risk profiles (approval-gated/async, config-time/static, and live/in-session) into one tool surface, which is the fastest way to produce an Iris that can accidentally do something irreversible mid-conversation with no confirm step, because "confirm before send" stops making sense once the action is "configure how the agent behaves live." Keep Iris narrow. It is a strength, not a limitation, per the audit's own scoping language ("nothing else — no bulk sends, no campaigns, no account or settings changes").

## 4. Acquisition-lens synthesis — the actual calls

**Moat-building differentiator vs. scope creep, stated directly:**
- **Template Management maturity fixes (§1)** — not a differentiator. Expected baseline; fix because gaps block real clients (auth-category especially), not because it impresses anyone.
- **RCM in-session rich replies (§2)** — a **real, narrow differentiator**, but only if positioned correctly: "the agent can respond richly inside an active conversation without waiting on template approval" is a genuine capability most competitor BSP consoles don't have, because most competitors only wrap Meta's own APIs and don't have a proprietary RCM layer sitting underneath. The moat is not "RCM exists" — it's "the ops person never has to think about template-approval latency when deciding what kind of reply their agent can give," because the product picked the right delivery mechanism invisibly. That invisibility is the product; exposing RCM as a channel choice destroys the differentiator.
- **AI-layer expansion beyond templates (§3)** — scope creep if generalized now. The one legitimate extension (auth-category templates) is not really "AI layer expansion," it's a template-studio fix that happens to route through Iris's existing contract.

**The one most important next capability bet, if forced to pick one:** **wire RCM's `build_buttons`/`build_list`/`build_cta` builders into the Skills response-format field from the prior doc as the in-session delivery path**, invisible to the ops person, selected automatically based on 24h-window state. This is the highest-leverage move because it's the only item here that (a) uses code that already exists and works, (b) closes a real capability gap (rich replies mid-conversation without template latency), and (c) does so without adding a single new screen, tab, or mental model — it slots into IA the prior doc already designed. Everything else in this doc is either lower-differentiation (§1) or correctly deferred (§3's mega-tool).

**The "no" list, same discipline as before:**
- **No "Karix RCM" tab, page, channel selector, or brand name surfaced to the ops person anywhere in the UI.** It's plumbing that should stay invisible, per §2.
- **No pitching RCM as "multi-channel" or "SMS/RCS fallback."** The code doesn't support non-WABA channels; claiming otherwise is a diligence-fail waiting to happen.
- **No unified "AI configures any rich message" tool for Iris.** Rejected in §3 — different risk profiles, different confirm semantics, don't collapse them.
- **No pre-approved template library / Meta catalog import** as a vision-level initiative — real gap, but file it as a normal Template Studio backlog item, not a headline bet.
- **No pacing/quality-tier dashboard as a new analytics surface.** If quality-tier visibility is added, it's a field next to the existing `quality_score` display in Template Studio, not a new reporting page — same "no BI feature dressed as vision" discipline the prior doc applied to `connectors.md`'s `/logs` stats.

**Where this fits the existing IA:** nowhere new. Template maturity fixes stay inside Template Studio. RCM's in-session builders fold into the Skills "Response format" field the prior doc already proposed (§1 of that doc) — they are the *delivery mechanism* for the same button/list/CTA response formats, selected automatically, not a parallel field or tab. Iris gets one narrow tool addition (auth-category templates) inside its existing 4-tool contract. No new page, no new tab, no new persistent header change beyond what the prior doc already specified.

## Appendix — capability research (factual)

| Source | Capability | Status today |
|---|---|---|
| Meta Template Management (no `docs/meta-api/templates.md` exists; verified via `TemplateStudioController.java`, `TemplateStudioClient.java`, `TemplateStudioPage.tsx`) | Create/edit/delete/list/get, media upload, bulk import, audit log, phone mapping | Implemented |
| Meta Template Management | Authentication-category (OTP) templates | Missing — no evidence in controller/frontend |
| Meta Template Management | Multi-language template families | Missing — single `language` field per template, no family/variant concept |
| Meta Template Management | Pre-approved template library / catalog import | Missing |
| Meta Template Management | Pacing/quality-tier → send-limit visibility | Missing — `quality_score` shown, tier consequence not surfaced |
| Karix RCM (`karix-mcp/karix_mcp/builders.py`) | `build_template` (approved template + params) | Wired — used via `TemplateStudioClient`/`KarixMessagingClient` |
| Karix RCM | `build_text`, `build_media`, `build_buttons`, `build_list`, `build_cta` | Built, zero backend/frontend callers — unused |
| Karix RCM (`karix_client.py`) | Channel scope | Hardcoded `"WABA"` — no non-WhatsApp channel exists in code, despite RCM naming |
| Iris (`IrisConversationService.java`) | Tool allowlist | Hard-coded 4 tools: `create_template`, `edit_template`, `list_templates`, `send_test_template`; templates only, confirm-then-execute enforced in code |
| BizAI Postman collection (`Meta Business Agent mdh_spices postman_collection 8 July v2.json`) | Coverage | Documents agent-config/skills/connectors/FAQ/onboarding only — zero template or RCM endpoints; not a substitute reference for either surface audited here |

Key files referenced: `backend/src/main/java/com/metaagent/platform/domain/templatestudio/TemplateStudioController.java`, `.../templatestudio/TemplateStudioClient.java`, `.../templatestudio/iris/IrisConversationService.java`, `.../templatestudio/iris/KarixMessagingClient.java`; `frontend/src/pages/TemplateStudioPage.tsx`, `frontend/src/pages/TemplateIrisPage.tsx`; `karix-mcp/karix_mcp/builders.py`, `karix_mcp/karix_mcp/karix_client.py`, `karix_mcp/karix_mcp/config.py`.

## Status

Vision proposal only — not yet run through PM/EM/EL/UX maker-checker gates for implementation. Recommended execution order: (1) auth-category template support — real blocker, cheap, routes through existing Iris contract; (2) RCM-as-in-session-delivery-mechanism folded into the prior doc's Skills response-format field — the highest-leverage bet, needs its own PM+EM gate since it's genuinely new wiring across the Python/Java boundary; (3) remaining Template Studio maturity items (multi-language families, library import, pacing visibility) as ordinary backlog, no vision gate needed.
