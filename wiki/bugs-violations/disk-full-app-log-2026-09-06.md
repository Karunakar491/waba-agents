---
title: Root Volume Full Again — app.log Reached 12G — Fixed — 2026-09-06
tags: [incident, infrastructure, disk, logging, logrotate, repeat-failure, resolved]
date: 2026-09-06
status: resolved
---

# Root Volume Full Again — `app.log` Reached 12G

## What was found

A routine frontend deploy failed at `scp`: `mkdir: cannot create directory
'/tmp/fe-20260906': No space left on device`. The 20G root volume was at 100%
with **0 bytes available**.

`/opt/metaagent/app.log` was **12,598,972,416 bytes** — 12G, 60% of the whole
volume, in a single unrotated file.

The site was still serving: `/actuator/health` 200, `/` 200, MySQL and
RabbitMQ both active. Nothing was down. But the application could no longer
write its own log, and any operation needing scratch space would have failed —
including the deploy that surfaced it, and including a database backup, which is
the thing we would most want to work in an emergency.

## Why the log grew

The tail was a RabbitMQ reconnect loop writing continuously:

```
Attempting to connect to: [localhost:5672]
An unexpected connection driver error occurred (Exception message: Connection reset)
Failed to check/redeclare auto-delete queue(s).
```

repeated at several lines per millisecond. Rabbit was active again by the time
this was investigated, so the loop had resolved on its own — but it had already
written gigabytes. The last content in the file was timestamped
`2026-09-05T04:51`, meaning the file had been full and unwritable for over a day
before anyone noticed.

## This is the third time

- **2026-08-13** — disk full, `app.log` the cause
- **2026-08-25** — disk full, `app.log` the cause
- **2026-09-06** — this one

After the first two, "configure logrotate" was written down as an open item and
carried in the memory index for weeks without being done. That is the actual
failure here. The log filling up is a predictable consequence of an unrotated
append-only file; the incident is that a known, one-file fix stayed open across
two outages.

## Fix

`/etc/logrotate.d/metaagent`:

```
/opt/metaagent/app.log {
    daily
    maxsize 500M
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

Two decisions in that file are load-bearing:

- **`copytruncate`** is required, not stylistic. The app appends through a shell
  redirect, so the running JVM holds the file descriptor. Renaming the file
  would leave the JVM writing to an unlinked inode — the disk would keep
  filling while `app.log` appeared to be small, which is worse than no rotation
  because it also hides itself.
- **`maxsize 500M`** is what actually protects us. `daily` alone is far too slow
  when a reconnect loop can write gigabytes within hours; this incident proves
  the daily window is not the binding constraint.

Verified by forcing a real rotation against the live open file:
`app.log.1` created at 28,638 bytes, `app.log` reset to 0, and the running JVM
kept appending afterwards (8,184 bytes twenty seconds later) with health still
200. The dry run also confirms the rule registers: "log files >= 524288000 are
rotated earlier". `logrotate.timer` is active.

## Recovery

1. `journalctl --vacuum-size=100M` — freed 192.9M of archived journals, enough
   to work in. `/var/log/journal` had grown to 225M.
2. Saved the last 20MB of the log to `/opt/metaagent/app.log.tail-20260906`
   before destroying it, so the reconnect storm remains diagnosable.
3. `truncate -s 0 /opt/metaagent/app.log` — **not** `rm`. The JVM holds the
   descriptor; deleting the file would have freed nothing until a restart.
4. Result: 7.5G used, 12G available, 39%. Health 200 throughout — no restart
   needed and no downtime.

No production data was involved at any point. Nothing was deleted except
archived systemd journals and the app's own log body.

## What is still wrong

- **Nothing alerts on disk.** This was found by a deploy failing, and the log
  had already been unwritable for over a day. A 12G file inside a 20G volume
  should have paged someone. Rotation stops this specific file from filling the
  disk; it does not tell us when something else does.
- **`/tmp` holds 400M+ of superseded jars** from August and early September, and
  `/var/www` holds 18 `metaagent.bak*` directories. Both are manual-deploy
  residue that nothing prunes. Left in place deliberately this time rather than
  deleted in passing during an incident.
- **Why RabbitMQ dropped connections** was not chased. It recovered on its own.
  It should not be able to cost us a volume when it happens again.

## Related

- [[../lessons/production-safety|Production Safety]]
- [[production-server-disk-cleanup-2026-08-13|Disk cleanup, 2026-08-13]] — the first occurrence
- [[../deployment/INDEX|Deployment]]
