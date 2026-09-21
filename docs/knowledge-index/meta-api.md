# Knowledge index: meta-api

One line per file, `path — purpose`. **Grep it. Never read it whole.**

    Grep pattern="AgentService" path=docs/knowledge-index/

A line points at a file; it does not narrate its history. Keep each under ~200
chars. A purpose needing a paragraph belongs in the file, in `TASKS.md`, or in
`wiki/`, not here.

Split by area so each file stays reviewable. A grep across the directory
searches all of them at once.

docs/meta-api/agent-eval.md — GET/POST /agent-eval — test and evaluate agent performance
docs/meta-api/agent-event.md — POST/GET /agent_event — trigger agent from business events
docs/meta-api/agent-onboarding.md — POST /agent_onboarding?channel=whatsapp — first-time BizAI entity creation.
docs/meta-api/agent-test.md — POST /agent_test — send test messages, get agent response, multi-turn support
docs/meta-api/allowlist.md — CRUD /agent_config/allowlist — restrict agent to specific phone numbers
docs/meta-api/business_info.md — GET/PUT/DELETE /agent_config/business_info — payment/return/purchase/delivery/contact info.
docs/meta-api/connector-tools.md — CRUD + run /agent_connectors/{id}/tools — platform proxies Meta with no server-side schema validation; run body input is JSON-encoded string. scopedPath on all writes. Verified 2026-09-03.
docs/meta-api/connectors.md — CRUD /agent_connectors — Map passthrough, nested auth_config (api_key/oauth2_client_credentials/empty for NONE), name slugified via toMetaConnectorName on library deploy.
docs/meta-api/delete-agent.md — DELETE /delete_agent — remove agent from phone number. Added 2026-08-04, formalizes an already-implemented endpoint (AgentDeployService.deleteFromMeta()).
docs/meta-api/eligibility.md — GET /agent_eligibility — bindPhone always GETs before provisioning; throws if is_eligible is false. No separate platform endpoint. Verified 2026-09-03 against bindPhone.
docs/meta-api/faq.md — CRUD /agent_config/faq — GET-by-id local AgentFaq; omit agent_id on FAQ GET (Meta 500 if added); best-effort Meta sync on write. Verified 2026-09-03.
docs/meta-api/files.md — GET/POST/DELETE /agent_config/files — document uploads (PDF, DOCX, images, CSV, XLSX)
docs/meta-api/INDEX.md — Master index of all Meta Business Agent APIs — paths, methods, setup sequence
docs/meta-api/settings.md — GET/PUT /agent_config/settings — rollout.enabled ↔ Agent.status via deploy/pause; ai_audience via separate platform endpoint; handoff copy vs Meta semantics unresolved. Verified 2026-09-03.
docs/meta-api/skills.md — CRUD /agent_config/skills — body field sent as skill; GET-by-id local agent_skill row; writes use scopedPath. Verified 2026-09-03.
docs/meta-api/thread-control.md — POST /thread_control — hand conversation back to Meta Business Agent (v1.0.0 API, different base URL); corrected note points to webhook-standby-handoff.md for the real handoff signal
docs/meta-api/ui-skills.md — GET/POST/PUT/DELETE /agent-ui-skills — rich-message components (carousel/CTA/flow/image/list/location). Shipped: AgentController /ui-skills → AgentService; local DB reads, flow type excluded.
docs/meta-api/webhook-standby-handoff.md — Real observed webhook shapes from partner pilot payloads (Jul 2026) — handoff signal is standby-wrapper presence/absence, NOT a messaging_handovers field; parsing rule for webhook controller
docs/meta-api/websites.md — CRUD /agent_config/websites — only writable field url; GET-by-id local AgentWebsite; Meta owns crawl_status/pages_crawled. Verified 2026-09-03.
