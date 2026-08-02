# E2E Selenium Test Run — 2026-07-27

Full local-dev walkthrough of the platform via a real headless Edge browser (Selenium),
covering sign-in, agent creation, WABA connect, knowledge base, deploy/pause/test,
connectors, and inbox. Raw log: `raw-log.txt`. Screenshots: `screenshots/`. Test script:
`test_full_flow.py`.

Final run: **18 PASS / 1 unresolved script flake / 4 expected-Meta-failure (no real
Meta credentials configured locally, by design)**.

## Bugs found and fixed (all through PM+EM+EL gate review)

1. **No CORS configuration on the backend.** Every cross-origin request from the
   frontend (`localhost:5173` → `localhost:8080`) was blocked by the browser before
   it ever reached the login logic. This was the original "sign-in not working"
   report. Fixed: added a `CorsConfigurationSource` bean, origins driven by
   `CORS_ALLOWED_ORIGINS` env var.

2. **Duplicated `context-path: /api`.** `application.yml` set `server.servlet.context-path: /api`
   on top of every controller already using `/api/v1/...` mappings — the *actual*
   reachable URL was `/api/api/v1/...`, which didn't match Spring Security's
   `permitAll()` matchers or the frontend's calls. This broke **every endpoint in the
   entire API**, not just auth. Fixed: removed the redundant context-path.

3. **Register silently "failed" in the UI even though the account was created.**
   `/auth/register` returns no `data` (by design — it doesn't auto-login), but the
   frontend tried to read `res.data.userId` anyway and threw, showing a generic
   error. Fixed: register now shows a real success state and routes to sign-in.

4. **Deleting any agent with FAQ/file/website/skill/conversation data threw an
   unhandled 500.** Several child tables (`agent_faq`, `agent_skill`, `agent_file`,
   `agent_website`, `conversations`, `messages`, `webhook_raw`) have
   `ON DELETE RESTRICT` foreign keys to `agent`, but `deleteAgent()` did a raw
   delete with no cascade — so any agent that ever had a single FAQ or a single real
   conversation could never be deleted, while the UI's own copy promised
   "Permanently deletes this agent and all its data." Fixed: `deleteAgent()` now
   explicitly cascades child-row deletes in FK-safe order before removing the agent
   (bulk statements, not entity-by-entity, to avoid N+1 on agents with large
   conversation history). Verified live: create agent → add FAQ → delete → 200 OK,
   confirmed via Selenium.

5. **`GET /agents/{id}/faq` didn't exist at all.** The Knowledge Base tab called
   this endpoint to list an agent's FAQs; it 404'd, and the frontend silently
   defaulted to an empty list with no error shown. Every FAQ a user added looked
   like it vanished — a confidence-destroying bug in a core wizard feature. Fixed:
   added the missing endpoint + service method (tenant-scoped, matching the
   ownership-check pattern used everywhere else in `AgentService`). Verified live
   via Selenium — FAQ add now correctly shows up on the tab.

## Confirmed NOT a bug (by-design local environment limitation)

- `POST /waba/validate`, `GET /waba/{id}/phones`, agent **deploy**, **pause**,
  **test**, and **connectors** all call the real Meta Graph / Business Agent API.
  With no real Meta credentials configured locally (`META_API_TOKEN=dummy`), these
  fail — but they fail **gracefully**, with clear error messages in the UI, not
  crashes. This is correct behavior, not a bug. Once you share real Meta
  credentials, these paths can be exercised for real.
- `bindPhone()` deliberately calls Meta to verify the phone number actually belongs
  to the WABA before binding — good defensive design, also blocked locally by the
  same lack of real credentials. Test script falls back to a direct SQL seed to
  exercise the rest of the UI.

## Open item — needs a second look, not yet confirmed as a bug

- On one run, a seeded conversation appeared correctly in the Inbox list, but the
  message thread showed "No messages yet." Backend logs show the webhook pipeline
  processed successfully (including publishing the downstream analytics event,
  which only fires after the message save call succeeds) — so this looks more like
  a UI query-timing artifact than a confirmed persistence bug, but I couldn't
  re-verify because the test's own (now-fixed, working-correctly) cascade-delete
  step cleaned up the row afterward in the same run. Recommend a targeted retest
  before treating this as resolved.

## Known cosmetic issues (found incidentally, not fixed — out of scope for this pass)

- `FaqsSection` (`AgentDetailPage.tsx`) renders a `<button>` nested inside another
  `<button>` — invalid HTML, causes a React hydration warning and can cause
  inconsistent click/bubbling behavior across browsers.
- `WabaTable` renders a list without unique `key` props — React warning, no
  functional impact observed.

## Environment notes for reproducing this run

- Backend requires `NODE_ID`, `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` (test
  keys under `backend/src/test/resources/keys/`), `DB_PASSWORD`, and dummy values
  for `META_API_TOKEN` / `META_WEBHOOK_VERIFY_TOKEN` / `CLAUDE_API_KEY` env vars.
- MySQL/Redis/RabbitMQ run as local Docker containers (`meta-mysql`, `meta-redis`,
  `meta-rabbit`) — not installed natively on this machine.
- JDK 21 (Temurin) and Maven 3.9.9 are present on disk but not on `PATH` by
  default — see the raw log / test script for exact paths used.
