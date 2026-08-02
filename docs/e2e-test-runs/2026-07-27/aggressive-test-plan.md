# Aggressive E2E Test Plan — Agent Creation Journey (2026-07-27)

**Safety rule (non-negotiable):** All runs in this plan execute against the mock
Meta API server (`mock-meta-server/mock_server.py`, port 9090), never against
real Meta or the real shared Karix WABA. See `mock-meta-server/README` (this
doc's companion section at the bottom) for exact backend env-var overrides.
This plan exists because a real-infra test earlier today overwrote a live
client's config. Never again — mock only for this class of testing.

Format: numbered checklist, one assertion per line, suitable for a human
tester or a Selenium/Playwright script. `[UI]` = browser action, `[API]` =
direct HTTP call to backend (which itself calls the mock), `[MOCK]` = direct
call to the mock server to set up/verify state.

---

## 0. Preconditions

- [ ] Mock server running on `http://localhost:9090` — `curl http://localhost:9090/health` returns `{"status":"ok"}`
- [ ] Backend restarted with mock overrides (see bottom of doc) — confirm via backend log line showing `meta.api.base-url=http://localhost:9090`
- [ ] Frontend pointed at that backend instance
- [ ] Test DB is a disposable/test schema, not shared with other test runs

---

## 1. Account registration + login

- [ ] `[UI]` Navigate to `/register`. Submit valid email + password + org name → account created, redirected to login or auto-logged-in
- [ ] `[UI]` Duplicate email registration → clear inline error, no account created
- [ ] `[UI]` Invalid email format → inline validation blocks submit
- [ ] `[UI]` Password below minimum length/complexity → inline validation blocks submit
- [ ] `[UI]` Login with correct credentials → redirected to dashboard, user object in app state has correct `userId`/email (see known bug class: login response is `data.data`, not `data.user`)
- [ ] `[UI]` Login with wrong password → clear error, no session created
- [ ] `[UI]` Rate limit: 21st login attempt within 15 min window (limit is 20/900s per `application.yml`) → 429
- [ ] `[API]` Confirm JWT issued, refresh flow works, refresh rate limit (30/60s) enforced

---

## 2. Agent creation wizard — 5 steps

### Step 1: Identity
- [ ] `[UI]` Enter agent name, description → Next enabled only when required fields valid
- [ ] `[UI]` Empty name → blocked with inline error
- [ ] `[UI]` Name at exact max-length boundary → accepted
- [ ] `[UI]` Name at max-length + 1 char → rejected or truncated (verify which — document actual behavior)

### Step 2: Personality
- [ ] `[UI]` Select/enter tone, instructions → Next enabled
- [ ] `[UI]` Instructions field at max-length boundary (mirrors Skills API `skill` 20000-char cap if reused) → accepted
- [ ] `[UI]` Instructions field over max-length → rejected with clear message, not a silent truncation

### Step 3: Knowledge / FAQs
- [ ] `[UI]` Add an FAQ (question + answer) inline in wizard → appears in list
- [ ] `[UI]` Add duplicate question → UI surfaces the mock's 409 `Duplicate FAQ` error cleanly (not a raw 500/stack trace)
- [ ] `[UI]` Empty question or empty answer → blocked client-side before hitting API
- [ ] `[UI]` Very long question/answer at/over any documented max length → verify graceful handling

### Step 4: Connect
- [ ] `[UI]` Prompted to connect a WABA/phone — covered in detail in Section 3 below
- [ ] `[UI]` Skipping connect (if allowed) → wizard still lets you reach Go-live but agent stays undeployed

### Step 5: Go-live
- [ ] `[UI]` Review screen shows correct summary of steps 1-4
- [ ] `[UI]` Deploy action available — covered in Section 4

---

## 3. WABA validate + phone connect (`ConnectPhoneModal`)

- [ ] `[MOCK]` Reset/seed: no prior connection for `mock-phone-1`
- [ ] `[UI]` Enter a WABA ID → "Validate" calls Graph `GET /{waba_id}?fields=id,name` → shows `Mock Test WABA`
- [ ] `[UI]` Phone list populates from `GET /{waba_id}/phone_numbers` → shows 3 mock phones (`+1 555 0100/0101/0102`)
- [ ] `[UI]` Select `mock-phone-1`, confirm connect → backend calls `agent_eligibility` (true) then reads/writes `agent_config/settings` for that phone
- [ ] `[UI]` **NEW pre-flight warning**: attempt to connect `mock-phone-1` to a SECOND agent while it's already connected to the first → warning modal appears before any write; confirm cancelling aborts cleanly with zero mock-side state change (`[MOCK] GET .../agent_config/settings` unchanged)
- [ ] `[UI]` Proceed anyway on the warning (if the flow allows override) → verify what actually happens to the first agent's connection (document actual behavior — this is the crux of today's earlier incident)
- [ ] `[UI]` Attempt to connect a phone that's already connected to a *different* agent (not just re-connecting the same one) → same pre-flight warning path, verify correct agent name/id shown in the warning message (not a placeholder)
- [ ] `[UI]` Invalid/garbage WABA ID → validate fails gracefully, no phone list shown
- [ ] `[UI]` WABA ID that returns phones but eligibility check would fail — simulate by pointing at a mock route that returns `is_eligible:false` (temporarily patch mock or add a query-param toggle) → connect blocked with clear reason

---

## 4. Deploy + pause + redeploy

- [ ] `[UI]` Deploy agent (first time) → `PUT agent_config/settings` with `rollout.enabled=true`; success state in UI
- [ ] `[UI]` **NEW pre-flight deploy guard**: attempt to deploy an agent missing required config (e.g., no phone connected yet) → guard blocks with specific missing-requirement message, no API call fires
- [ ] `[UI]` Deploy an already-deployed agent a second time (double-deploy) → verify idempotent behavior (no duplicate agent_id, no error, or a clear "already deployed" message — document actual behavior)
- [ ] `[UI]` Pause agent → `rollout.enabled=false`; verify `[MOCK] GET agent_config/settings` reflects `enabled:false`
- [ ] `[UI]` Redeploy after pause → `enabled:true` again, same `agent_id` reused (not a new one)
- [ ] `[API]` Confirm re-enabling only affects NEW threads per settings.md semantics (note: mock doesn't model thread-level distinction — this is a backend/UI-copy assertion, not a mock behavior to verify)

---

## 5. Skills — API only (UI tab is placeholder)

- [ ] `[API]` `POST /{phone}/agent_config/skills` with valid title/description/skill → 201, mock assigns id
- [ ] `[API]` Title violating naming rule (uppercase, spaces, leading hyphen) — verify backend validates before forwarding, OR forwards and mock accepts anything (mock does not validate title format — document that backend validation is the actual enforcement point)
- [ ] `[API]` `skill` field at 20000-char boundary → accepted; +1 over → backend should reject before calling mock
- [ ] `[API]` `GET /{phone}/agent_config/skills` → newly created skill appears
- [ ] `[API]` `DELETE /{phone}/agent_config/skills/{id}` → 204, then GET confirms removal
- [ ] `[API]` Verify "sync" — whatever internal job/cache mirrors Meta skills into our DB — reflects the created/deleted skill (check actual sync mechanism in codebase before asserting timing)

---

## 6. FAQs — UI and API

- [ ] `[UI]` Add FAQ via Knowledge tab → appears in list, persisted
- [ ] `[UI]` Delete FAQ via UI → removed from list and from mock (`[MOCK] GET faq` confirms)
- [ ] `[API]` Add FAQ directly → 201
- [ ] `[API]` Add exact-duplicate question directly → 409 `Duplicate FAQ`, verify backend surfaces this as a 409 (not swallowed/500'd) to any future UI caller
- [ ] `[API]` Delete via API → 204

---

## 7. Connectors

- [ ] `[API or UI]` Create a connector (`name`, `description`, `base_url`, `auth_type: NONE`) → 201, `connection_status.status = ACTIVE` (mock always returns ACTIVE)
- [ ] Add a tool to the connector: `name: send_template_message`, method `POST`, path `/messages`, body params describing template name + recipient → 201
- [ ] `GET` tools for connector → new tool listed
- [ ] `POST /{connector}/tools/{tool_id}/run` with `input` referencing a template name → mock returns `status: queued`, mock `message_id`, and explicit `note: "mock only — no real WhatsApp template was sent"` (assert this note is present so nobody mistakes mock output for a real send)
- [ ] Delete the tool → 204, then list confirms removal
- [ ] Delete the connector → 204, confirm its tools are gone too (`tools_by_connector` cleared server-side)

---

## 8. Test Agent drawer (live message test)

- [ ] `[UI]` Open Test Agent drawer, send a message matching a stored FAQ question → response equals the FAQ's answer (mock pattern-matches)
- [ ] `[UI]` Send a message matching a stored skill's title (with hyphens replaced by spaces) → response references that skill
- [ ] `[UI]` Send an unrelated message → generic canned mock response, not an error
- [ ] `[UI]` Multi-turn: verify `conversation_id` from response 1 is reused in request 2, and drawer maintains thread continuity

---

## 9. Edge cases — aggressive pass

- [ ] Duplicate WABA connect attempt → pre-flight warning fires (see Section 3)
- [ ] Connect a phone already connected to another agent → pre-flight warning fires with correct target agent identified
- [ ] Deploy twice → documented idempotent/blocked behavior (see Section 4)
- [ ] Delete an agent that has FAQs + skills + a test conversation history → cascade delete verified: re-query DB/mock, confirm no orphaned FAQ/skill rows and mock-side state for that phone is irrelevant (mock is not the source of truth for deletion — backend DB cascade is what's under test; mock only needs to not error if backend also calls DELETE against it during cleanup)
- [ ] Invalid/malformed input at every wizard step (empty required fields, wrong types, script-injection strings in text fields to confirm proper escaping/sanitization on render)
- [ ] Very long strings at every documented max-length boundary (name, skill title/description/skill body, FAQ question/answer, connector name/description) — boundary and boundary+1
- [ ] Concurrent operations: fire two simultaneous `PUT agent_config/settings` for the same phone (e.g. two browser tabs deploying at once) → verify no corrupted state, last-write-wins or optimistic-lock rejection (document actual behavior)
- [ ] Concurrent FAQ creation with the same question from two clients at once → verify only one succeeds (409 for the loser) even under a race, not just under sequential calls

---

## Mock Server Reference

**Location:** `mock-meta-server/mock_server.py`
**Start:** `cd mock-meta-server && python mock_server.py` (defaults to port 9090; override with `PORT=9091 python mock_server.py`)
**Stop:** Ctrl+C in its terminal, or kill the background process.
**Health check:** `curl http://localhost:9090/health`

**Implemented — Business Agent API** (base `http://localhost:9090/{phone_number_id}/...`):
`agent_eligibility` (GET), `agent_config/settings` (GET/PUT), `agent_config/skills` (GET/POST/DELETE),
`agent_config/faq` (GET/POST with 409-on-duplicate/DELETE), `agent_config/websites` (POST/DELETE),
`agent_config/files` (POST multipart/DELETE), `agent_connectors` (GET/POST/DELETE),
`agent_connectors/{id}/tools` (GET/POST/DELETE/run), `agent_test` (POST, FAQ/skill pattern-matching).

**Implemented — Graph API** (base `http://localhost:9090/graph/{version}/...`):
`GET /{waba_id}?fields=id,name`, `GET /{waba_id}/phone_numbers` (returns 3 fake phones per waba_id).

**Not implemented** (not in scope per docs, or genuinely not needed for this plan):
skill/FAQ/connector `GET {id}`/`PUT {id}` single-item routes, connector `logs`/`upsertApiKey`/`upsertCertificate`/`upsertOAuth`,
thread-control, webhook-standby-handoff, agent-eval, agent-event, allowlist. Add if a future test plan needs them.

**Backend env-var overrides needed to point at this mock (do NOT restart the currently running real-token backend — this is for a separate restart the user performs):**

```
--meta.api.base-url=http://localhost:9090
--meta.graph.base-url=http://localhost:9090/graph
--meta.api.token=dummy-mock-token
```

or as environment variables (Spring relaxed binding):

```
META_API_BASE-URL=http://localhost:9090     # note: Spring relaxed binding — verify exact env var casing works;
                                             # command-line --meta.api.base-url=... form above is the reliable option
META_GRAPH_BASE-URL=http://localhost:9090/graph
META_API_TOKEN=dummy-mock-token
```

`meta.api.version` and `meta.graph.version` do not need to change — the mock mounts Graph routes under
`/graph/<version>/...` so whatever version string the backend sends (`v19.0` by default) is accepted as a path segment.
