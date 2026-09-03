# Deploy 2026-09-04 — UI fixes and the draft-delete deadlock

## What went live

Backend jar and frontend bundle, both built from **`22d07eb`** (frontend
rebuilt once mid-deploy; see the sequence below).

| Change | Commit |
|---|---|
| Draft agents deletable after the wizard claimed their number | `a595e34` |
| Second pause guard in `deleteFromMeta` exempted for drafts | `45319ef` |
| Interactive messages rendered in the Inbox | `2f22d57` |
| Handoff webhooks highlighted + "Handoffs only" filter; "Publish" → "Save changes" | `b9afd33` |
| Agents list: Status column replaces the raw Agent ID | `53a6b9e` |
| Dashboard: "Agents live", WABA by name, no Agent ID column | `6feebc9` |
| Inbox shows which day a conversation happened | `24a2284` |
| Breadcrumb fix, Persona Library silent 400, `Conversation.agentId` as string | `b8e40f5` |
| `[interactive]` in the webhook log summary too | `22d07eb` |
| Retention change **backed out** of this deploy | `9e8f991` |

**No migration.** `git diff --name-only 73b2b5f..HEAD` showed no migration
files, and both restarts logged "Successfully validated 54 migrations" with
nothing applied. No backup-before-migration was therefore required, and no
production data was touched by the deploy itself.

## What was backed out, and why

Staging the whole `backend/.../webhook/` directory swept in two files that had
been deliberately held back: a 48-hour purge of unattributed `webhook_raw`
rows and a schedule change from daily to six-hourly. That is a data-deleting
behaviour change and does not belong in a deploy whose subject is a badge and
a button label. Reverted in `9e8f991` before anything was built. Practical
impact would have been near zero — the table holds 552 rows and zero
unattributed — which is not the point.

## Sequence

1. `git diff 73b2b5f..HEAD` for migrations → none. Backend files reviewed
   one by one, which is how the retention files were caught.
2. `mvn clean package` (not `compile` — see the lessons page).
3. Uploaded to `/tmp`, **md5 compared** local vs remote before touching the
   live path: `76fc7c53…` both sides.
4. Copied the running jar to
   `/opt/metaagent/target/platform-ROLLBACK-20260903192513.jar`, then swapped.
5. `systemctl restart metaagent` → "Started PlatformApplication in 26.15s".
6. Second pause guard found in production (below), fixed, rebuilt, re-uploaded
   (`59028bf9…` both sides), restarted → "Started in 28.076s".
7. Frontend: `npm run build`, tar, upload, md5 compare, backup
   `/var/www/metaagent` to `/tmp/metaagent-backup-*.tar.gz`, swap, then verify
   the **served** asset's md5 against the local build.
8. Frontend rebuilt and redeployed once more after a screenshot showed
   `[interactive]` surviving in the webhook log.

## Rollback

- Backend: `mv /opt/metaagent/target/platform-ROLLBACK-20260903192513.jar` over
  the live jar, `systemctl restart metaagent`. Under a minute.
- Frontend: `sudo tar xzf /tmp/metaagent-backup-20260903195320.tar.gz -C /var/www/metaagent`.
- Neither reverts data, because this deploy changed none.

## The second guard, found by deploying

Deploying the first fix and then actually deleting the stuck draft returned
HTTP 200 with one step failed:

```
FAILED   Agent configuration — Pause the agent before removing it from Meta.
```

There were **two** pause guards — `AgentTeardownService` and
`AgentDeployService.deleteFromMeta` — and only the first had been fixed. A
deleted draft therefore left its agent configuration behind on Meta. Fixed in
`45319ef` with two tests: a draft is removed from Meta without a pause, and an
active agent is still refused.

Only exercising the real delete found this. The unit test for the first fix
passed the whole time.

## Verified live

- Full teardown after the fix: `metaFullyCleaned: true`, including
  "Agent configuration — Removed from 892937373893469 on Meta."
- `+91 90100 82954` back to `alreadyConnected: false` — **the demo account can
  create an agent again**, which it could not before this deploy.
- `handoffSignal` present on `/webhooks/raw`; `?handoffSignal=NEEDS_HUMAN`
  returns 43 rows, all correctly classified.
- `conversations.agentId` now `"882515538725572608"` as a string, full value
  intact.
- `HandoffClassifier` log lines appearing under real traffic — proof the new
  code is running, not just a clean restart.
- 11 browser tests pass against production, including a new one asserting the
  "Handed to a human" badge actually renders and the filter returns rows.
- Screenshots checked by eye: `agents-list.png`, `dashboard.png`,
  `inbox-list.png` (dates now read "Wed", "28 Aug", "27 Aug"),
  `handoff-02-filtered.png`.

## Noted while verifying, not fixed

The webhook payload contains `"profile": {"name": "Mohammed Haroon"}`. The
customer's name **is** available and we discard it — audit item 16 is
therefore a real, cheap fix rather than a data limitation.

Still open and untouched: token refresh being unwired (the biggest item),
conversations never closing, 11.6s agent latency, and the four half-built
screens.
