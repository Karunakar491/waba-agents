---
title: Deployment
tags: [deployment, index]
---

# Deployment

## Pages
- [[server-config|Server Config]] — AWS instances, ports, services, credentials
- [[runbook|Deploy Runbook]] — step-by-step deploy procedure
- [[lessons|Hard-Won Lessons]] — 10 lessons from real deploys

## Current State (confirmed 2026-08-04 — corrects the 2026-07-20 entry below, which conflated two different servers)
- **Our app** (`metaagent.service`) runs on `ubuntu@10.1.17.16` — private, reachable ONLY via bastion (both `ec2-user@13.232.241.246` and `ubuntu@13.206.206.254` work, see [[runbook|runbook]]). Real systemd service, not a manual PID file — confirm exact jar path via `sudo systemctl cat metaagent.service` before deploying (see [[lessons|lesson #12]], there's a stray unused `platform.jar`).
- Actual running jar: `/opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar`
- Config at `/opt/metaagent-config/application.yml` — separate directory, NOT under `/opt/metaagent/`, never touched by deployments.
- **`karix-mcp` and `karix-messaging.service` run on a DIFFERENT server** (`10.1.128.214`, the bastion box itself at `13.206.206.254`) — not the same machine as our app. `karix-messaging` was confirmed ACTIVELY RUNNING 2026-08-04 (contradicts the stale "stopped and disabled" note below, which was wrong or has since changed).
- Frontend static files at `/var/www/metaagent` on the `10.1.17.16` box, served by nginx, `location /api/` proxies to `127.0.0.1:8080`.
- Port **8080** on `10.1.17.16` — our app only, per the current systemd unit's `After=`/`Wants=` (mysql/redis/rabbitmq), no karix-messaging conflict on this box.

## Current State (2026-07-20, superseded above)
- App running on `ubuntu@10.1.17.16` (private, via bastion)
- PID in `/opt/metaagent/app.pid`
- Source at `/opt/metaagent/` — build on server with `mvn clean package -DskipTests`
- Config at `/opt/metaagent/src/main/resources/application.yml` (server copy — do NOT overwrite)
- JWT keys at `/opt/metaagent/keys/`
- Port **8080** — `karix-messaging` stopped and disabled (files kept at `/home/ubuntu/karix-messaging-service/`, re-enable with `sudo systemctl enable --now karix-messaging`)

## ⚠️ Placeholders (not production-ready)
- `meta.api.token` = `placeholder_set_real_token`
- `claude.api.key` = `placeholder_set_real_key`
Real tokens must be set before any Meta API or Claude API calls work.
