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

## 17. Take a fresh DB backup immediately before EVERY migration that deletes/moves rows, even mid-session (2026-08-13)
A backup taken at the start of a deploy session is stale by the time a later, unrelated migration in the same session runs. Before `V47` (a real data-deleting migration), a brand-new `mysqldump` was taken immediately before applying it — separate from the app-level backup taken earlier in the same session for the schema-only migrations (`V42`–`V46`). This caught real value: `V47` failed its first two attempts live (FK ordering, then a collation mismatch — see [[../bugs-violations/hard-delete-migration-never-touches-meta-2026-08-13|writeup]]), and each failed attempt needed to be verified as a clean rollback (`SELECT COUNT(*)` on the rows in question) before touching the migration file again. Flyway wraps each migration in one transaction, so a failed migration rolls back cleanly on its own — but verify that with a live count query, don't just assume it, and don't rely on a backup that predates other changes made earlier in the same session.

## 18. After a failed migration, delete Flyway's own failed-attempt row before retrying — this is metadata cleanup, not a data operation
A migration that fails mid-execution leaves a `success=0` row in `flyway_schema_history` for that version. Flyway will not re-attempt a version it already has a row for (failed or not) without either `flyway repair` or manually deleting that one row (`DELETE FROM flyway_schema_history WHERE version=<N> AND success=0`). This is *not* a violation of the no-raw-SQL/no-destructive-SQL rule — it's Flyway's own internal bookkeeping table, not application or business data, and the `WHERE` is scoped to the exact failed version. Do this before every retry of a fixed migration file, or the retry itself will fail Flyway's own out-of-order/already-resolved validation before your fixed SQL ever runs.

## 19. A raw data-deleting migration only cleans local rows — it can't touch an external system
`V47` deleted 6 agents from the local DB in one migration. None of those agents' real Meta-side WhatsApp Business Agent configuration, skills, or connectors were touched — a SQL `DELETE` has no way to call an external HTTP API. Discovered when a later reconciliation pass in the same session silently rediscovered and recreated local shadow rows for the still-live Meta-side agents. If any row being deleted has a live counterpart on Meta (or any external system), the app's own delete/teardown code path must run first (see [[../bugs-violations/hard-delete-migration-never-touches-meta-2026-08-13|full writeup]]) — a migration should only be the tool of choice for rows that are purely local, or for the leftover WABA-level rows that genuinely have no Meta-side equivalent once every agent under them is properly torn down first.

## 20. Relaxing a NOT NULL FK column must keep its exact type, including UNSIGNED, or MySQL rejects it (2026-08-13)
`ALTER TABLE webhook_raw MODIFY COLUMN account_id BIGINT NULL` failed live with MySQL error 3780 ("Referencing column and referenced column ... are incompatible") — the referenced column (`business_account.id`) is `BIGINT UNSIGNED` (per `V5__normalize_ids_to_bigint_unsigned.sql`, which normalized every id in the schema), and a bare `BIGINT NULL` silently drops `UNSIGNED`, which MySQL treats as a real type mismatch for FK purposes, not just a nullability change. `MODIFY COLUMN` must restate the *entire* column definition every time, not just the part you're changing. Before loosening any FK'd column's nullability, check the actual referenced column's full type first (`V5` is the canonical source for this app's id columns) rather than assuming a bare `BIGINT`/`INT` matches. Failed cleanly (MySQL DDL is atomic per statement; verified via `SHOW COLUMNS` that nothing had changed), fixed to `BIGINT UNSIGNED NULL`, redeployed successfully.

## 21. Every new TSID-typed field needs `@JsonSerialize(ToStringSerializer.class)` — a missing one is silent, not a compile error (2026-08-13)
Added `ApiCallLog.agentId` (a `Long` TSID) for a new filter without the `ToStringSerializer` annotation every other TSID field in this codebase carries. Compiled fine, deployed fine, looked fine in a spot-check — only caught by deliberately cross-checking the *same* real agent's id as displayed by two different endpoints and noticing the last few digits didn't match (JS `Number` silently rounds anything past `Number.MAX_SAFE_INTEGER`, so a TSID displayed without this annotation isn't obviously wrong, it's *plausibly* wrong). Would have made the entire "filter by agent id" feature unusable in a completely silent way — copy an id from one screen, paste it into the filter, get zero results, with no error anywhere. Lesson: when adding any new `Long` field that holds an id generated by `TsidGenerator`, add the annotation in the same edit, and verify by comparing a real value against another endpoint that already displays the same id correctly — don't just check that a request "returns something."
