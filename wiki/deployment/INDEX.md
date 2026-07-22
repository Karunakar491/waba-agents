---
title: Deployment
tags: [deployment, index]
---

# Deployment

## Pages
- [[server-config|Server Config]] — AWS instances, ports, services, credentials
- [[runbook|Deploy Runbook]] — step-by-step deploy procedure
- [[lessons|Hard-Won Lessons]] — 10 lessons from real deploys

## Current State (2026-07-20)
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
