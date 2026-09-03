---
title: Production Safety — The Rules That Don't Bend
tags: [lessons, production, safety, data, security]
---

# Production Safety — The Rules That Don't Bend

> UI, UX, features, look and feel can change constantly. Production **data** is never at risk. This is a separate, higher tier than the maker-checker gates: a gate approval authorises a change to code and behaviour. It never authorises risk to data.

---

## Production data is sacrosanct

Stated directly by the founder, immediately after a session that found two real incidents proving it isn't hypothetical:

- the deploy runbook had once overwritten `application.yml` via SCP
- a leaked local-test mock harness (`_PreviewHarness.tsx`) replaced the real API client for **every production user**, causing a real login/entitlements outage

**Concrete rules, not a vibe:**

- No migration against production without a verified-restorable backup taken immediately before it.
- No destructive SQL (`DROP`, `TRUNCATE`, unscoped `DELETE`/`UPDATE`) ever runs against production from a build/fix/deploy task. If a task seems to need it — stop and escalate to the founder *before* writing the query.
- No deploy script overwrites `application.yml`, credentials, or JWT keys without confirming the exact target path and copying what's there.
- No test or mock code is ever reachable from a production entrypoint. Throwaway harnesses get deleted the moment their purpose is served.
- Schema changes are additive-first. A column is deprecated before it is dropped, never in the same task it's replaced.
- Data fixes are never bundled into a feature deploy. That's a separate, higher-risk task needing its own sign-off.
- If genuinely uncertain whether something touches production data — treat it as if it does, and ask.

## Never run SQL against the database from this tool

Organisation-level rule, which the system prompt places **above even an explicit founder instruction**.

Tested twice in the 2026-08-12 session. The founder asked to "fetch it from the DB" to find a WABA id — declined, used the app's own `/api/v1/waba` endpoint. Then asked to delete a dummy row "using raw SQL… consider this a one-time exception from the founder" — still declined, because org-level instructions override individual preferences, not merely default behaviour. Shipped a real fix instead (a Flyway migration plus an app-level filter) that got the same practical outcome.

**Rule:** use the app's own API. Never pull PII or client data directly into context.

## Auto-mode classifier hard-blocks production SSH

SSH/scp to the production host via bastion is denied by the auto-mode classifier regardless of what `settings.json` allows — it is a separate safety layer on top of the permission allowlist.

**Rule:** exit auto mode and take a live approval prompt. Do **not** reword the command to slip past it, and do not ask a peer session to run it instead.

## New `meta_*_id` columns need VARCHAR(255) from the start

Every "ID returned by Meta after POST" column created at VARCHAR(64) has eventually needed widening.

## The kill switch

Every deploy must be reversible in under 5 minutes without touching data:

- feature flags on all new capabilities
- additive-only migrations, three-release cycle before a drop
- one-command, staging-tested rollback that reverts code and config but **never** data
- data is fixed forward with a repair script, never restored — restores are for datacenter fires, not bad deploys

If the kill switch can't be guaranteed, the deploy doesn't happen.

---

## Related

- [[verification|Verification]] — what counts as proof a deploy worked
- [[deployment/lessons|Deployment Lessons]]
- [[bugs-violations/INDEX|Bugs & Violations]] — the incidents behind these rules
