---
title: Connector Creation Never Succeeds Against Real Meta — 2026-08-13
tags: [bug, connectors, meta-api, unresolved, post-mortem]
date: 2026-08-13
---

# Connector Creation Never Succeeds Against Real Meta

## What Happened
While building the IndiaMART Buyer Discovery Agent's Google Sheets-backed connectors, every attempt to deploy a Connector Library definition to a real agent failed with an identical, generic Meta error:

```json
{"title":"Invalid connector request","detail":"The request is not valid for this connector.","status":400}
```

Checking `api_call_log` for the entire history of this application found **zero successful `POST .../agent_connectors` calls, ever** — not just tonight. Every connector that appeared "live" on any agent during this session's earlier delete/teardown testing was pre-existing on Meta from before this app started tracking API calls; our own creation code path has never been proven to work.

## What Was Ruled Out (all tested live, all failed identically)
1. **`auth_config` shape** — tried flat (`{"headers": [...]}`, matching the actually-committed historical code from `f2cee71`) and nested under a type key (`{"api_key": {"headers": [...]}}`, per an auto-memory note claiming this was the historical fix). Both got the identical error.
2. **Auth type** — tried both `NONE` and `API_KEY`.
3. **`base_url` reachability** — tried a fake, unregistered domain (`test-store.myshopify.com`) and a real, confirmed-live, publicly reachable URL (our own published Google Sheet CSV feed, verified working via direct `curl` outside the app). No difference.

## An Important Correction Made Along the Way
An auto-memory note (`project_mdh_deployment_and_nav_2026_07_29.md`) claimed the historical fix was nesting `auth_config` under a type-named key. Checking the actual git history (`git log -S"auth_config"`) showed the real, committed, historically-successful code (commit `f2cee71`) uses the **flat** shape — the memory's specific technical claim contradicted the actual code. Applied the nested fix first (per the memory), confirmed it didn't help, then found the discrepancy and reverted to match the real committed history. **Lesson: when a memory's specific technical claim can be checked against actual code/git history, check it — don't take the memory's word over the artifact it's describing.**

## RESOLVED (2026-08-13, same day, later)
The generic 400 was real and was caused by exactly the payload-shape hypothesis this post-mortem had already ruled out — but ruled out on the wrong evidence. Root cause, found via a real, dated reference artifact (`Meta Business Agent mdh_spices postman_collection 8 July v2.json`) that had a working, historically-used `connector` request against real Meta:

**Meta does require `auth_config` nested under the type-named key** (`{"api_key": {"headers": [...]}}`), not flat. The "flat shape matches historically-working commit f2cee71" claim above was checked against the wrong artifact — `f2cee71`'s backend (`AgentDeployService.createConnector`) is a pure pass-through proxy with no shape logic at all; the actual shape came from the frontend (`AgentDetailPage.tsx`), which by 2026-08-13 had *already* been fixed to the nested shape with a comment citing a real live Meta 400 ("`auth_config.api_key is required for API_KEY auth type`") — that fix was just never carried over into the newer `ConnectorLibraryService.metaPayload` (added later, still on the stale flat shape), which is the only path this investigation tested.

**Fix:** `ConnectorLibraryService.metaPayload` now nests API_KEY under `api_key` and OAuth2 under `oauth2_client_credentials`, matching the frontend's already-proven shape. Added `ConnectorLibraryServiceTest` (2 cases). `metaPayload` changed from `private` to package-private so the test can call it directly.

**Live proof:** deployed a real connector (`shopifycartconnector`, Shopify Storefront cart) + its `create_cart_multipleitems` tool onto the live MDH agent via the legacy per-agent endpoint (`POST /agents/{id}/connectors`, same nested shape) — Meta returned 200 with a real connector id and `connection_status: ACTIVE`. Used a placeholder credential value (no real Shopify Storefront token was available) since Meta validates the connector's structure at creation time, not the credential's validity against the third-party API — proves the shape fix, not yet a working checkout flow. Real token to be swapped in later without any further code change.

## Two more real Meta validation quirks found retrying the IndiaMART Sheets connectors (2026-08-13, later same day)
Retrying the pre-existing `IndiaMART Supplier Search API`/`IndiaMART Pricing API` (Demo via Sheets) library connectors — both `auth_type: NONE` — still failed with the identical generic 400 even after the fix above, because these hit two more distinct gaps:

1. **`auth_config` must be present even for `NONE`.** Omitting it entirely (which `metaPayload` did for `NONE`, since only `API_KEY`/`OAUTH2` branches set it) gets the same generic 400. Confirmed live: same request with `"auth_config": {}` added → 200. Fixed: `metaPayload` now sends `Map.of()` for `NONE`.
2. **`name` must be a plain identifier — no spaces, no parentheses.** `"IndiaMART Pricing API (Demo via Sheets + Apps Script)"` got the same 400; the identical request with only the name changed to `indiamart_pricing_api` (same base_url, same everything else) got 200. This is a genuine Meta constraint on `agent_connectors.name`, distinct from `description` (free text, unaffected). Fixed: `metaPayload` now sends a sanitized slug (`toMetaConnectorName` — lowercase, non-alphanumeric runs collapsed to `_`) as `name` while the Connector Library's own `name` column (the human display label) is untouched.

Added `should_send_empty_auth_config_object_for_none_auth_type` and `should_sanitize_display_name_into_a_plain_identifier_for_meta` to `ConnectorLibraryServiceTest` (now 5 tests total). Deployed to production (2 separate jar deploys, backup+byte-verify+health-check each time, per Kill Switch discipline).

**Result on the real IndiaMART agent:** `indiamart_pricing_api` (Apps Script Web App backing a Google Sheet) deployed **LIVE** with a real `metaConnectorId`. `indiamart_supplier_search_api` (Google Sheets *published-CSV export* URL) still fails — its `base_url` is `https://docs.google.com/.../pub?output=csv`, which has a query string baked in; Meta's `base_url` almost certainly expects bare scheme+host+path with tool-level paths/params appended separately. This is a connector-definition data issue, not a platform bug — deliberately not guessed at further this session; left as an open, scoped follow-up.

## Follow-up: making Supplier Search actually work (2026-08-13, same day, later)
Picked the deferred follow-up back up. Full chain of real, live-diagnosed issues, each fixed in turn:

1. **The "published Google Sheet" CSV link redirects.** `https://docs.google.com/spreadsheets/.../pub?output=csv` returns an HTTP 307 to `doc-0o-bk-sheets.googleusercontent.com/...` — confirmed via a direct `curl -D -` (no `-L`). Meta's connector infra doesn't follow it: the tool call hung ~30s then came back as a generic 500. **Fix:** replaced the data source with a Google Apps Script Web App (same reliable pattern already proven by the sibling Pricing connector) — founder built and deployed it (`doGet()` reading the real sheet via `SpreadsheetApp.openById`, returning `{"suppliers": [...]}` as direct JSON, `Content-Type: application/json`, no redirect). Iterated live through 3 real script bugs on the founder's side: unquoted sheet ID (JS syntax error), wrong tab name in `getSheetByName` (fixed by using `getSheets()[0]` instead), then a working deploy — each confirmed via direct `curl -sL` against the `/exec` URL before wiring it in.
2. **`base_url` + tool `path` concatenation bug.** Set `base_url` to the full URL including `/exec`, and the tool's `path` to `/`, producing a `.../exec/` double-up that Google's front-end 404s as "Requested resource not found" (a Google Drive error page, not an Apps Script error — proof it never reached the script). Confirmed by calling the tool directly via Meta's own `POST /agent_connectors/{id}/tools/{id}/run` — the *strongest* signal available, since it bypasses whether BizAI decided to invoke anything and shows exactly what Meta sent/got. **Fix:** `base_url` trimmed to end at the deployment ID (no `/exec`), tool `path` set to `/exec` — standard base+path composition. Re-ran via `run` and got the real data back (`status: success`, actual supplier rows).
3. **Skill wording never named the real tool.** The `supplier-search-and-pricing-lookup` skill said "call the IndiaMART Supplier Search connector" — vague, and predating the tool's real name. Rewritten to name `get_supplier_sheet` explicitly (backtick-quoted) and describe its exact JSON shape, matching the precise, name-explicit style already used in the MDH agent's imported skill pack (e.g. `checkout-with-cart` naming `create_cart_multipleitems` directly with exact field shapes) — general "the connector" phrasing versus a literal tool name is a real, observed difference in whether the model actually calls it.

**Confirmed working (direct Meta test):** `POST .../tools/{id}/run` returns the real dataset successfully.
**Not yet confirmed working (conversational):** BizAI itself still times out (~30s → generic 500) or returns empty text when it tries to use the tool inside `agent_test`. Hypothesis, not yet verified: the tool's raw response as seen via `run` is extremely verbose — the Apps Script's clean JSON is wrapped inside Meta's own diagnostic envelope (full echoed HTTP response headers, CSP report tokens, an `actionRunId`, etc.), which may be too noisy/large for the model to parse quickly. Deliberately stopped here rather than keep changing live connector config without a clear next signal — explicit founder call to pause.

## Related additions
- Google Apps Script (`doGet`) for Supplier Search is now the client's own asset (in their Google account), not something in this codebase — noted here since it's load-bearing for this connector and would otherwise be invisible to a future reader.

**Old status while unresolved (for history):** no code-side hypothesis explained the identical generic 400 across every variable tested at the time; candidates considered included a lost capability grant, a changed Meta API contract, or a sandbox/verification-tier restriction. None of those were the actual cause.

## Related
- [[../decisions/reusable-library-over-meta-execution-2026-08-13|Reusable Library Over Meta Execution]] — the feature this blocks from being fully live-verified
- [[../decisions/indiamart-buyer-discovery-agent-2026-08-13|IndiaMART Buyer Discovery Agent]] — the real use case waiting on this
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
