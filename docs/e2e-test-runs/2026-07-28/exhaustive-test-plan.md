# Exhaustive E2E Test Plan — 2026-07-28

**Safety rule (non-negotiable, unchanged from earlier sessions):** all runs in this
plan execute against the **real Meta API**, using only the designated permanent
test number **1103393549522539 (+91 91520 04283)** on WABA `494227720434920`.
The other numbers on that WABA (Karix Sales Assistant, MakeMyTrip, Licious) are
real, live client agents and must never be touched.

**Test subject agent:** "BlissFit Wellness Assistant" — an original (non-scraped),
BlissClub-competitor-styled fitness/wellness brand, used only as realistic demo
content. Website field points at `https://www.blissclub.com` per the founder's
instruction — Meta crawls it natively; we never scrape it ourselves.

Format: one row per Meta capability, mapped to (a) whether a UI path exists to
test it today, (b) the Selenium/API test case, (c) result after running it.

---

## 0. Coverage matrix — what's actually testable via the UI today

| Meta capability | UI exists? | How tested |
|---|---|---|
| agent_eligibility | ✅ (via Connect phone flow) | Selenium: connect phone number |
| agent_config/settings (deploy/pause) | ✅ | Selenium: Publish & Test, Pause |
| agent_config/skills | ❌ no UI (`SkillsPlaceholder` — "Skills coming soon") | API only — gap logged |
| agent_config/faq | ✅ | Selenium: Knowledge tab |
| agent_config/files | ❌ UI stub, upload button not wired (`// TASK-036: wire POST /agents/:id/files`) | Not tested — gap logged |
| agent_config/websites | ❌ UI stub, add button not wired (`// TASK-036: wire POST /agents/:id/websites`) | API only — gap logged |
| agent_connectors (create/delete) | ✅ | Selenium: Connectors tab |
| agent_connectors/{id}/tools (create/delete) | ✅ | Selenium: Connectors tab |
| agent_connectors/{id}/tools/{id}/run | ❌ no "Run" button anywhere in the UI | Not tested — gap logged |
| agent_test | ✅ | Selenium: Test Agent drawer, persona conversations |
| agent-eval (cases/run/details/summary) | ✅ per-agent tab + Reports rollup | Selenium: Eval tab, Reports > Eval |
| agent_event (trigger/poll) | ✅ | Selenium: Settings > Trigger event |
| thread-control (release) | ✅ | Selenium: Thread Control button (requires handoff enabled + active) |
| agent_config/business_info | ✅ (Business Profile tab) | Selenium: create draft, deploy, verify history |
| delete_agent | ✅ (requires paused first) | Selenium: verify disabled-until-paused; NOT executed to completion (would destroy the only persistent test agent) |
| agent_config/allowlist | ❌ not built (deferred, PM-blocked earlier this session) | Not tested — out of scope by design |
| Conversation logging | ✅ (Reports > Conversations) | Selenium: verify count increments after test messages |
| API call logging | ✅ (Reports > API Calls) | Selenium: verify entries appear for calls made during this run |

**Gaps this run will surface as findings, not silently work around:** Skills UI,
Website/File upload wiring, connector-tool "Run" button, Allowlist.

---

## 1. Build the agent (mixed UI + API, per gap table above)

- [ ] `[UI]` Create agent via wizard: name "BlissFit Wellness Assistant", business description (original wellness-brand copy), tone Friendly
- [ ] `[UI]` Connect phone number 1103393549522539 (WABA 494227720434920) — expect the pre-flight warning (number already has prior test content), click Continue
- [ ] `[UI]` Add 3–5 FAQs (payment, delivery, membership perks — original copy)
- [ ] `[API]` Add 5 skills directly via `POST /agents/{id}/skills` (no UI exists) — title/description/body for: identity, handoff-guardrails, lead-qualification, order-support, membership-upsell
- [ ] `[API]` Add website `https://www.blissclub.com` via `POST /agents/{id}/websites` (no working UI button — this call goes straight to Meta's `agent_config/websites`, which crawls it natively; we never scrape it ourselves)
- [ ] `[UI]` Add 1 connector ("Order Status API", dummy base_url, auth NONE) + 1 tool (`check_order_status`, GET `/orders/{order_id}`)
- [ ] `[UI]` Deploy (Publish & Test)

## 2. Persona-driven conversation testing (Test Agent drawer)

- [ ] `[UI]` Persona "curious new customer" — asks about membership perks, expects FAQ-sourced answer
- [ ] `[UI]` Persona "existing customer with an order issue" — expects handoff-guardrail or connector-tool behavior
- [ ] `[UI]` Persona "price negotiator" — expects handoff per skill's guardrails
- [ ] `[UI]` Multi-turn conversation — verify conversationId continuity across turns

## 3. Cross-feature verification

- [ ] `[UI]` Business Profile tab — create draft, deploy, verify old (if any) moves to History as "Saved"
- [ ] `[UI]` Settings > Trigger event — fire `payment_received`, verify status resolves (not stuck pending)
- [ ] `[UI]` Eval tab (per-agent) — list cases, run eval, verify summary renders in plain language
- [ ] `[UI]` Reports > Conversations — verify total count and success rate reflect this run's test messages
- [ ] `[UI]` Reports > Eval — run account-wide rollup, verify it includes this agent
- [ ] `[UI]` Reports > API Calls — verify entries exist for the calls made above (skills/websites POSTs, deploy PUT, test POSTs, event POST, eval calls), confirm no secrets appear in logged bodies
- [ ] `[UI]` Settings > "Remove agent from Meta" — verify button is disabled with explanatory text while agent is Active (do NOT actually pause+delete — this is the only persistent test agent, destroying it breaks future test runs)

## 4. Findings

(Filled in after the run — see conversation for the live findings summary delivered to the founder.)
