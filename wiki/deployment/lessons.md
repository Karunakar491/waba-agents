---
title: Hard-Won Deployment Lessons
tags: [deployment, lessons]
---

# Hard-Won Deployment Lessons

Each of these caused a crash cycle on the first deploy. Know them before touching the server.

## 1. NODE_ID must be env var — not JVM flag
```bash
# WRONG
java -DNODE_ID=1 -jar ...

# CORRECT
env NODE_ID=1 java -jar ...
```
`PlatformApplication.main()` reads `System.getenv("NODE_ID")`, not system properties.

## 2. JWT uses key file paths — not inline PEM
Properties: `jwt.private-key-path` and `jwt.public-key-path`
Keys live at: `/opt/metaagent/keys/jwt-private.pem` and `jwt-public.pem`
Never embed PEM in application.yml — multiline breaks env var sourcing.

## 3. lombok.config required for @Qualifier
File: `backend/lombok.config`
Content: `lombok.copyableAnnotations += org.springframework.beans.factory.annotation.Qualifier`
Without it, Spring can't resolve which of the two RedisTemplate beans to inject.

## 4. RedisConfig — cacheRedisConnectionFactory must be @Primary
Two LettuceConnectionFactory beans (DB0 cache, DB1 security).
Spring Boot auto-config picks one — needs `@Primary` on cache bean.
Also mark `cacheRedisTemplate` as `@Primary`.

## 5. CSRF must be fully disabled
Stateless JWT API. `.csrf(csrf -> csrf.disable())` — not just webhook paths.

## 6. application.yml must include meta.api.version = v19.0
`MetaApiClient` injects `${meta.api.version}` — fails to start if missing.

## 7. pkill kills the SSH session
```bash
# WRONG — kills SSH
pkill -f platform-0.1.0-SNAPSHOT

# CORRECT
kill $(cat /opt/metaagent/app.pid)
```

## 8. SCP via bastion requires ProxyCommand
```bash
scp -o "ProxyCommand=ssh -W %h:%p -i KEY ec2-user@BASTION" KEY LOCAL ubuntu@SERVER:REMOTE
```

## 9. Nested SSH for commands (SSH agent not running in Bash tool)
```bash
ssh -i KEY ec2-user@BASTION "ssh -i /tmp/deploy.pem ubuntu@SERVER 'command'"
```

## 10. Never SCP application.yml to the server
The server keeps its own `/opt/metaagent/src/main/resources/application.yml` with hardcoded dev credentials.
SCP'ing our source overwrites it → app fails with unresolved `${META_API_TOKEN}` placeholder.
Build on server: `cd /opt/metaagent && mvn clean package -DskipTests`

## 11. Check this wiki BEFORE touching SSH (2026-08-04)
Lost most of a session rediscovering the bastion IP, user, and key location that were already written down in this exact file. **Read `wiki/deployment/runbook.md` first, every time** — before trying any key, before guessing at server IPs from memory alone. Memory files can drift; this wiki is the checked-in source of truth once it exists.

## 12. The stray `platform.jar` trap (2026-08-04, RECURRED 2026-08-07)
`/opt/metaagent/platform.jar` exists on the server but is **NOT what the systemd service runs** — it's leftover from an earlier deploy convention. The real, live jar `metaagent.service` executes is `/opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar` (confirm via `sudo systemctl cat metaagent.service`, check `ExecStart`). Copying a new build to `platform.jar` and restarting the service silently does nothing — the restart succeeds, logs look fine, but it's still running the old code. **Always confirm the exact `ExecStart` path from the unit file before deploying a new jar — don't assume the "obvious" filename.**

**This happened again on 2026-08-07** during a long overnight session — despite being documented right here. Deployed a backend change to `/opt/metaagent/platform.jar`, restarted, health check returned 200, treated it as shipped. Only caught it ~40 minutes later because a live API regression test against the specific feature that changed returned data proving the old code was still running (a field that should have been populated was silently null). **The health check passing is not evidence the new code is live** — an old jar restarts just as cleanly as a new one. The only real proof is testing the specific behavior you just changed, live, after every backend deploy. Read this file before every deploy session, not just the first time.

## 13. Fast deploy alternative: build locally, swap the jar (no on-server Maven build)
The documented method (rsync source → `mvn clean package` on the server) works but is slow and needs the server's own toolchain to stay in sync. A faster, verified-working alternative when the server already has the right JDK/deps cached:
```bash
# Local: build excluding uncommitted migrations (see lesson 14), then
mvn -q clean package -Dmaven.test.skip=true
# scp the resulting target/platform-<version>.jar through the bastion (double-hop, see lesson 9)
# then on the server:
sudo cp /opt/metaagent/target/platform-<version>.jar /opt/metaagent/target/platform-<version>.jar.bak.$(date +%s)
sudo cp <new-jar> /opt/metaagent/target/platform-<version>.jar
sudo chown ubuntu:ubuntu /opt/metaagent/target/platform-<version>.jar
sudo systemctl restart metaagent
```
Same for the frontend: `npm run build` locally (confirm `.env.production` sets `VITE_API_URL=/api/v1`, NOT a `localhost` fallback — check the built bundle has zero `localhost` references before shipping), tar the `dist/` folder, scp through the bastion, extract into `/var/www/metaagent` (back up the old directory first). No nginx restart needed — static files.

## 14. Exclude uncommitted/WIP migrations from a build before deploying
If `backend/src/main/resources/db/migration/` has an uncommitted, in-progress migration (check `git status` — if it's untracked and paired with untracked Java files, it's WIP from a separate unfinished task), temporarily move it out of the migration folder before `mvn package`, then move it back afterward. Shipping it prematurely would lock its checksum into the production Flyway history before the feature it belongs to is actually reviewed/committed.

## 15. Two working bastions exist, only one was documented
`ec2-user@13.232.241.246` (documented, see below) and `ubuntu@13.206.206.254` (undocumented, discovered 2026-08-04) both grant SSH access into the same private network and can both reach `ubuntu@10.1.17.16`. Either works with the same `.pem` key. Prefer the documented one for consistency; the second is a fallback if the first is ever unreachable.

## 16. Local full-stack testing without touching the server
When server access is blocked, a completely real (non-mocked) local test environment is possible: Docker containers for MySQL/Redis/RabbitMQ (use a different host port than any pre-existing container on the machine), a locally-generated JWT RSA keypair + AES crypto master key via `openssl`, `NODE_ID=0`, dummy values for `META_API_TOKEN`/`META_WEBHOOK_VERIFY_TOKEN`/`CLAUDE_API_KEY` (fine since real Meta/Claude calls aren't being tested), and direct SQL inserts into `account_modules`/`waba`/`waba_account_access` to unlock the UI without needing real credentials. Point the frontend's `.env.local` at `http://localhost:8080/api/v1`.
**Gotcha:** login cookies are `Secure` — only honored by browsers on `https://` or the literal hostname `localhost`, never a network IP (even `127.0.0.1` fails in some browsers; only `localhost` is guaranteed). Always test at `http://localhost:<port>`, never an IP, or auth silently fails and looks like a permissions/entitlement bug instead of a cookie bug.
