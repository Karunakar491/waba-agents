---
title: Deploy checklist — connector + persona login sync (V58), 2026-09-21
tags: [deployment, checklist, migration, connectors, persona]
date: 2026-09-21
status: not-yet-run
---

# Deploy checklist — connector + persona login sync

Two phases, deliberately. **Phase A puts the code on the box with both flags
off** — nothing new calls Meta, nothing new writes a row, and the only things
being proven are that the app starts, V58 applies, and the bean graph is
acyclic. **Phase B turns the behaviour on** as a separate, visible step.

That split exists because the data change and the code change must not share
one approval. With the flags defaulting true the first login after boot would
clear rows in `connector_deployment`, and a jar swap does not put them back.

Pre-state is already captured: `connector-sync-2026-09-21-rollback-capture.md`.

## Before anything

- [ ] `cd D:/mba-backfill && git rev-parse HEAD` — record it. Confirm the branch
      is `feature/connector-action-backfill`, **not** master. A previous deploy
      was nearly built from the wrong branch.
- [ ] Build **locally**. Never on the box: `/opt/metaagent/src` is stale and
      building there would revert migrations
      (`reference_production_deploy_traps_2026_09_18`).
      `mvn -f backend/pom.xml clean package -DskipTests`
- [ ] `unzip -l backend/target/*.jar | grep -E "ConnectorBackfillService|V58__"`
      — both must appear. Do this **locally**; `unzip` is not installed on the
      box, and assuming otherwise once produced a false "the class isn't there".
- [ ] `df -h /` on the app server. 43% at last check. The dump below is the
      largest disk event this box sees this month and there is still no disk
      alerting.

## Phase A — code on the box, behaviour off

- [ ] Timestamped copy of the config **before** touching it:
      `cp /opt/metaagent-config/application.yml /opt/metaagent-config/application.yml.bak-$(date +%Y%m%d%H%M%S)`
- [ ] Append both flags set **false**. Explicitly, not by relying on the code
      default — a restart on a box missing the key would silently enable them:
      ```yaml
      connector:
        action-backfill:
          enabled: false
      persona:
        login-backfill:
          enabled: false
      ```
- [ ] Verified-restorable backup before the restart that runs V58:
      `mysqldump --single-transaction --routines meta_agent_db > /var/backups/meta_agent_db-preV58-<ts>.sql`
      then load it into a scratch schema and compare `COUNT(*)` on
      `connector_deployment`, `connector_action`, `business_profile` against
      live. **A dump nobody restored is not a backup.** Drop the scratch schema.
- [ ] Keep the current jar:
      `cp /opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar /opt/metaagent-jars/rollback-before-connector-backfill-$(date +%Y%m%d%H%M%S).jar`
- [ ] `scp` the new jar, compare byte size both ends, swap, `systemctl restart metaagent`.
- [ ] Deploy at **HH:05**, just after the hourly sweep, leaving ~55 minutes of
      dark running before the next one.

### Abort triggers — within 90 seconds, all must hold

- [ ] `systemctl is-active metaagent` → `active`
- [ ] `Started PlatformApplication` in `app.log`
- [ ] `Migrating schema ... to version 58` with no Flyway error, then
      `SELECT version, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3` → 58 / 1
- [ ] health endpoint 200
- [ ] **zero** of: `BeanCurrentlyInCreationException`, `Circular`,
      `UnsatisfiedDependencyException`, `Schema-validation`

Any one failing → swap the rollback jar, restart, stop. **Do not debug on a
down production.** V58 stays applied and that is safe: `ddl-auto: validate`
tolerates columns the old entity does not map.

- [ ] Watch 30 minutes. Confirm **no** `Back-filled`, **no** `Connector gone
      from Meta` — the flags are off, so their absence is the proof they work.

## Phase B — turn it on

- [ ] Re-run the pre-state `SELECT` from the rollback capture and confirm it
      still matches. If it has drifted, stop and re-read.
- [ ] Flip both flags true in `/opt/metaagent-config/application.yml`
      (timestamped copy again first), restart at **HH:05**.
- [ ] The first login-triggered sweep touches one account before the hourly
      sweep touches everything. That is the 5%.

### Watch for the rest of the hour

| Log line | Meaning |
|---|---|
| `Back-filled N of M Meta tools` | the repair — expected on IndiaMART Product Search |
| `Some Meta tools could not be read` | partial import; follow up, not an abort |
| `Connector gone from Meta, marked not published` | **expect exactly 2, once.** A third, or any repeat on a later sweep → abort |
| `Meta listed none of this agent's N known connectors` | floor guard fired; means a bad Meta response → flags false, investigate |
| `Connector backfill failed` / `Connector action backfill failed` | swallowed by design, so they surface nowhere else. Count them |
| Meta 429 / rate limit | tier-2 goes ~4 → ~5 GETs per agent per sweep |

- [ ] `SELECT COUNT(*) FROM connector_action` before and after — the only hard
      number proving the repair happened.
- [ ] p95 latency and error rate against the pre-deploy hour.

## The one path nothing automated proves

`ConnectorLibraryService.delete()` now deletes deployment rows before the
connector, inside one transaction. `fk_connector_deployment_connector` (V46:66)
is RESTRICT, so the flush order has to be right. **No test proves this** — a
stub repository cannot see MySQL 1451 and the Testcontainers suite is dead on
Docker 25+. EL traced the ordering by reading and accepted it as read-only
verification.

- [ ] After Phase B settles, delete **one** of the two marked-gone IndiaMART
      connectors **through the UI, not SQL**. Check `app.log` for
      `SQLIntegrityConstraintViolationException`, `1451`, or
      `fk_connector_deployment_connector`.
- [ ] Only if that is clean does the second one get touched.

## Rollback

`cp /opt/metaagent-jars/rollback-before-connector-backfill-<ts>.jar /opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar && systemctl restart metaagent`

Under 5 minutes, no database touched. V58 stays applied.

**The row writes do not roll back.** Restoring them is a separate task requiring
founder sign-off — values are in the rollback capture. Do not pre-write an
`UPDATE` and do not run one under this deploy's approval.

## Afterwards

- [ ] Move or delete the mysqldump off `/` once signed off.
- [ ] `df -h /` again.
- [ ] Record the outcome here, including anything that did not go to plan.
