---
title: Rollback capture — connector/persona login sync (V58), 2026-09-21
tags: [deployment, rollback, connectors, migration]
date: 2026-09-21
status: pre-deploy
---

# Rollback capture — before deploying the connector sync

Taken **before** `feature/connector-action-backfill` is deployed. The jar rolls
back in one swap and `V58` is additive, but **the row writes do not roll back**:
once the sweep clears `deployed_at` and `meta_connector_id`, reverting the jar
does not restore them. This file is how they get restored.

Read-only `SELECT`. Nothing was modified taking it.

## Production state at capture

| | |
|---|---|
| `flyway_schema_history` max version | **57**, `success = 1` |
| `systemctl is-active metaagent` | `active`, since 2026-09-17 21:29 UTC |
| Running jar | `/opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar` |
| Rollback jar | `/opt/metaagent-jars/rollback-before-toolsync-20260917212729.jar` |
| Disk | 20G total, 8.2G used (43%) |

The box's `/opt/metaagent/src` is stale and was **not** used to determine schema
state — the live `flyway_schema_history` was read directly. See
`reference_production_deploy_traps_2026_09_18`.

## All 8 `connector_deployment` rows, before

```
id                  connector_id        agent_id            deployed_at                  last_error
875659519416340480  875653066773237760  875651765431701504  2026-08-13 15:28:13.234727   NULL
875659521651904512  875653210100994048  875651765431701504  2026-08-13 14:30:02.421451   NULL
878126437763125248  878126359136702464  875651765431701504  2026-08-20 04:04:17.679910   NULL
887682473582923776  887661280964382720  887643060282855424  2026-09-15 12:53:14.044341   NULL
887682531854389248  887661358131187712  887643060282855424  2026-09-15 12:53:27.937894   NULL
888155021143707648  887661280964382720  888030775306358784  2026-09-18 07:37:48.164671   NULL
888155080279199744  887661358131187712  888030775306358784  2026-09-17 21:59:02.808947   NULL
888155161367678976  887979641610964992  888030775306358784  2026-09-17 21:59:12.893114   NULL
```

## The two rows the sweep is expected to change

Both are IndiaMART connectors whose `meta_connector_id` returns **404** from
Meta — verified live on 2026-09-20 through `/agents/{id}/connectors/{metaId}/tools`,
and again via `api_call_log` where Meta's own status is recorded as 404 rather
than the 400 our error handler returns to the client.

| Row id | Connector | `meta_connector_id` (to restore) | `deployed_at` (to restore) |
|---|---|---|---|
| `875659519416340480` | IndiaMART Supplier Search | `pfbid0GXMy41uBZUruYBsepcgEknqavGeq7PQ4ikBP6RccNsDRXcYjZew8iq4yrhXu3p8uJwYjUrKES12sEamKimsdRUfJ6BYVNR94zuWQl` | `2026-08-13 15:28:13.234727` |
| `875659521651904512` | IndiaMART Pricing | `pfbid08z3Zz1q7wxgPsktgf2hz6n8nd7mApeaTAZechK9gtQAx36pQPuCn4MN2fzCzVaBiAHiC2uyho51GBxhFVR9u4JN4gJxai4ktJTPml` | `2026-08-13 14:30:02.421451` |

After the sweep both should read `deployed_at = NULL`, `meta_connector_id = NULL`,
and `last_error = 'Meta no longer lists this connector. It was deleted or rebuilt there.'`

**No other row should change.** Agent `875651765431701504` keeps its third
deployment (`878126437763125248`, IndiaMART Product Search) because Meta still
lists it — which is also what stops the floor guard engaging, since the guard
only refuses when Meta lists *none* of an agent's connectors.

## If these two need restoring

Scoped `UPDATE`s by primary key, one row each, values above. **Requires founder
sign-off before running** — CLAUDE.md treats any production-data change as a
separate, higher-risk task, and this file exists to make that decision possible,
not to pre-authorise it.

Restoring them puts the rows back to claiming a Meta connector that does not
exist, which is the state this change was written to correct. The only reason to
do it is to get back to a known-previous state during an incident.

## Expected new rows

`connector_action` rows for IndiaMART Product Search — Meta lists **1** tool
(`product_search`). Those are additive; rolling back the jar leaves them, which
is harmless: they describe a tool that genuinely exists on Meta.
