---
date: 2026-09-03
type: process
tags: [deployment, backend, frontend, kill-switch, traceability]
status: active
---

# Deploy record — batch 2, four approved features (2026-09-03)

## What shipped

Commit `5b3ccf0`. **Backend and frontend both deployed** — the first backend
deploy from an exact commit rather than a jar built on the box.

Four features, founder-approved:

1. Message → webhook tracing (Inbox jump-to-payload)
2. Webhook log rewritten with filters and plain-English summaries
3. Skill editing moved to a full page
4. Connector tool editor tabbed into Params / Headers / Body

Plus a shared-modal sizing sweep (every dialog wider) — not attached to any
feature but riding in the same bundle, so it is the most visible difference.

## Deliberately NOT shipped

- **Two-tier webhook retention.** Deletes production rows. Measured first:
  **973 rows, 2.1 MB** on first run. Held out — it is not the fix for the
  disk-full outages (`app.log` is; logrotate is still unconfigured), so it
  deletes production data for negligible benefit. Isolated to
  `WebhookRawRepository` + `WebhookRetentionJob`, left uncommitted.
- **Campaign filter** (cluster 2) — founder excluded. Worth revisiting:
  4,878 of 5,430 `webhook_raw` rows (90%) are unattributed, very likely the
  shared-WABA campaign traffic this filter drops at the door.
- **Business Profile draft-workflow removal** (cluster 5) — founder dropped.
- Unpublish UI stays flag-off (`Am(void 0)` confirmed in the new bundle too).

## Migration safety

No migration ran. Flyway on startup:

```
Successfully validated 54 migrations (execution time 00:00.183s)
Schema `meta_agent_db` is up to date. No migration necessary.
```

Exactly as predicted from the pre-deploy checksum work — V54 and V55 were
already applied 2026-08-20 and the committed files' CRC32s match the recorded
values, so validation passed instead of refusing to start.

## Test evidence

Honest and partial:

- `ConversationStoreTest` — **4/4 pass in isolation**, including the
  `webhookRawId` assertions (42 inbound, 99 outbound) that directly cover the
  shipped change. This required fixing the test: it hardcoded `ACCOUNT_ID=1001`
  / `AGENT_ID=2001` and only ever passed because another class left matching
  rows in the reused Testcontainers MySQL. Failed on `fk_conv_agent`, then
  `fk_agent_account`. Now seeds both per test.
- `StatusUpdateParserTest` 9/9, `AgentDeployServiceTest` 21/21,
  `AgentServiceBindPhoneOnboardingTest` 5/5, `TsidGeneratorTest` 4/4.
- `mvn -o clean test-compile` and `npx tsc --noEmit` both exit 0.

**The full suite does not pass on master.** `ModuleAccessFilterTest`
(5 failures) and `RateLimitFilterTest` (7 errors) fail in areas this batch
never touches. Not proven pre-existing, but unrelated to these diffs. Filed as
debt — the suite cannot currently act as a deploy gate.

**No frontend test coverage.** Two pure-function test files exist for ~21,000
lines of UI, and there is still no Playwright/Cypress/Testing-Library. Every UI
change here is verified only by `tsc` and by byte-identity of what's served.

## Verification

| Check | Result |
|---|---|
| Jar transfer integrity | 87,018,179 bytes / md5 `fd826c19…` — identical both ends |
| Jar backup before swap | `/tmp/jar-backup-20260903164630.jar`, md5 `ada2696f…` |
| V54/V55 present in new jar | both PRESENT (checked before deploy) |
| Service readiness after restart | READY in 40s, `systemctl is-active` → `active` |
| Flyway | validated 54, no migration necessary |
| App start | `Started PlatformApplication in 27.204 seconds` |
| Frontend transfer integrity | 306,303 bytes / md5 `035cd024…` — identical |
| Frontend backup pre-swap | `/tmp/metaagent-fe-backup-20260903164903.tar.gz`, 10 entries |
| Swap method | `rsync -a --delete`, ownership captured and restored |
| Served index.html | 200, references `assets/index-Ce_GneJl.js` |
| **Served asset md5 vs local build** | `0bc4d21ca64460024a31fb2c1d660840` — **exact match** |
| Old bundle removed | `index-CEDyBwb2.js` → 404 |
| Unpublish flag still off | `Am(void 0)` present in served bytes |
| Public path | `https://app.karix.online/` → 200, new bundle |

## Kill Switch

**Rollback — backend:**
```bash
cp /tmp/jar-backup-20260903164630.jar /opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar
sudo systemctl restart metaagent
```
**Rollback — frontend:**
```bash
sudo tar xzf /tmp/metaagent-fe-backup-20260903164903.tar.gz -C /var/www/metaagent
sudo chown -R www-data:www-data /var/www/metaagent
```
Both code-only, no data. Under 5 minutes. No canary — single box, no load
balancer; same named exception as prior deploys.

**Rollback triggers:** non-200 on index.html or asset; API not returning 401/200
after restart; any Flyway validation error in `app.log`; an Unpublish button
visible in the UI; founder reports the app or Inbox broken.

## Outstanding

- **No browser smoke test.** Four UI features shipped with zero automated UI
  coverage. Worth a founder pass over Inbox → jump-to-webhook, the Webhooks
  panel, skill edit, and the tool editor.
- Backend test suite red in unrelated areas — needs its own task.
- `iris/phase-1` still unmerged: tasks 1–7 done, 8–13 not. Task 11 (Bean
  Validation on mutating tools) is why it should not ship yet — delete/update
  tools already exist without their guardrail.

## Related
- [[2026-09-03-master-deploy|Batch 1 deploy — Unpublish flagged off]]
- [[2026-09-03-master-build-repaired|Clean-checkout build verification]]
