# TASKS.md — Meta Business Agent Platform
**Last Updated:** 2026-07-22  
**Standard:** All fixes held to CLAUDE.md bible. No self-approval. EL reviews every change.

---

## CONFLICTS — RESOLVED (2026-07-19)

| # | Conflict | Decision | Reason |
|---|---|---|---|
| C1 | JWT transport | httpOnly cookie + RS256 ✅ | More secure, no cost difference, XSS protection |
| C2 | Analytics storage | MySQL consolidated ✅ | No extra server cost, right for current scale |
| C3 | HTTP client | Replace WebClient with RestClient ✅ | No extra dependency, included in spring-boot-starter-web |

---

## CRITICAL — Runtime Crashes (fix first, nothing works without these)

### TASK-001 — Agent entity missing `systemPrompt` field
- **Status:** `[x] DONE`
- **File:** `domain/agent/entity/Agent.java`
- **Caller:** `domain/conversation/service/ConversationService.java → buildSystemPrompt()`
- **Bug:** `agent.getSystemPrompt()` is called but the field does not exist on the entity. NPE / compile error on every inbound message.
- **Fix:**
  1. Add `systemPrompt TEXT NULL` to `Agent` entity
  2. Add Flyway migration `V3__add_agent_system_prompt.sql`
  3. Update `AgentRequest` DTO to accept `systemPrompt`
  4. Update `AgentService` to persist it

---

### TASK-002 — `SecurityContextHelper` called from RabbitMQ listener thread
- **Status:** `[x] DONE`
- **File:** `domain/conversation/service/ConversationService.java → loadMessageHistory()`
- **Bug:** `SecurityContextHelper.getRequiredAccountId()` reads Spring Security context. RabbitMQ listener threads have no Security context → `IllegalStateException` on every message.
- **Fix:**
  1. Remove `SecurityContextHelper` call from `loadMessageHistory()`
  2. Pass `accountId` as a parameter — it is already on the `WebhookRaw` entity
  3. Propagate `accountId` down through `processWebhookEvent(accountId, ...)` signature
  4. Never call SecurityContextHelper from async/listener/scheduled threads

---

## CRITICAL — Security Violations (against bible)

### TASK-003 — JWT not in httpOnly cookie
- **Status:** `[x] DONE`
- **Files:**
  - `common/security/JwtAuthFilter.java` — reads from `Authorization` header, must read from cookie
  - `common/security/SecurityService.java` — sets tokens in response body, must set `ResponseCookie`
  - `domain/user/controller/AuthController.java` — returns `AuthResponse` with tokens, must not
  - `config/SecurityConfig.java` — no cookie config
  - `domain/user/dto/AuthResponse.java` — carries raw tokens
- **Fix (if bible wins):**
  1. `AuthController.login()` / `refresh()`: use `HttpServletResponse`, add `ResponseCookie` with `httpOnly=true`, `sameSite=Strict`, `secure=true`, `maxAge=15min`
  2. `JwtAuthFilter`: read token from `Cookie` header, not `Authorization`
  3. `AuthResponse`: remove `accessToken` / `refreshToken` fields — return only `{ "status": "ok" }`
  4. `SecurityConfig`: add `.csrf()` config appropriate for cookie-based auth
  5. Logout: `AuthController.logout()` must clear the cookie via `ResponseCookie` with `maxAge=0`

---

### TASK-004 — Hardcoded default verify token in WebhookController
- **Status:** `[x] DONE`
- **File:** `domain/webhook/controller/WebhookController.java`
- **Bug:** `@Value("${meta.webhook.verify-token:MetaAgentVerifyToken}")` — if `META_WEBHOOK_VERIFY_TOKEN` env var is missing, falls back to a known string. This is a hardcoded secret.
- **Fix:** Remove the default. Use `@Value("${meta.webhook.verify-token}")` only. Application must fail to start if missing. Add to required env vars list in `application.yml` startup validation.

---

### TASK-005 — ClaudeApiClient silently accepts empty API key
- **Status:** `[x] DONE`
- **File:** `infrastructure/claude/ClaudeApiClient.java`
- **Bug:** `@Value("${claude.api.key:}")` defaults to empty string. All Claude API calls will auth-fail silently at runtime.
- **Fix:** Remove default. Use `@Value("${claude.api.key}")`. Add startup assertion: fail fast if blank.

---

## CRITICAL — Multi-Tenant Isolation Violation

### TASK-006 — `account_id` missing on 5 child entities
- **Status:** `[x] DONE`
- **Files:**
  - `domain/agent/entity/AgentFaq.java`
  - `domain/agent/entity/AgentSkill.java`
  - `domain/agent/entity/AgentFile.java`
  - `domain/agent/entity/AgentWebsite.java`
  - `domain/agent/entity/AgentWebsitePage.java`
- **Bug:** Bible rule: `account_id` on EVERY table. These 5 entities are missing it. Direct queries have no tenant column — data leakage possible.
- **Fix:**
  1. Add `account_id BIGINT UNSIGNED NOT NULL` + FK to `accounts(id)` ON DELETE RESTRICT to all 5 entities
  2. Add Flyway migration for each table
  3. Update `AgentService` to populate `account_id` on creation from `SecurityContextHelper.getRequiredAccountId()`
  4. Add `account_id` filter to all repository queries on these entities

---

## HIGH — Architecture Violations

### TASK-007 — Raw SQL strings in AnalyticsService
- **Status:** `[x] DONE`
- **File:** `domain/analytics/service/AnalyticsService.java`
- **Bug:** 6 inline `createNativeQuery(sql)` calls. Bible rule: no raw SQL strings in Java.
- **Fix:** Move all 6 queries to `@NamedNativeQuery` annotations on entities, or `@Query` annotations on repositories. Replace `createNativeQuery` calls with typed repository method calls.

---

### TASK-008 — Raw SQL strings in SearchService
- **Status:** `[x] DONE`
- **File:** `domain/search/service/SearchService.java`
- **Bug:** 2 inline FULLTEXT SQL strings in `createNativeQuery()`. Bible rule: no raw SQL.
- **Fix:** Move FULLTEXT queries to `@Query` annotations on `AgentFaqRepository` and `AgentWebsitePageRepository`. Use Spring Data's native query support.

---

### TASK-009 — Analytics tenant isolation missing in AnalyticsController
- **Status:** `[x] DONE`
- **File:** `domain/analytics/controller/AnalyticsController.java`
- **Bug:** `getAgentSummary(agentId)` and `getHourlyPerformance(agentId)` accept any `agentId` without verifying it belongs to the calling account. Any authenticated user can read any account's analytics.
- **Fix:** In `AnalyticsService`, verify `agent.getAccountId() == SecurityContextHelper.getRequiredAccountId()` before returning data. Throw `NotFoundException` (not `ForbiddenException` — do not leak existence) on mismatch.

---

### TASK-010 — `CompletableFuture.runAsync()` in AgentService escapes transaction
- **Status:** `[x] DONE`
- **File:** `domain/agent/service/AgentService.java → addWebsite()`
- **Bug:** Website page crawling runs in `CompletableFuture.runAsync()` outside the `@Transactional` context of `addWebsite()`. DB writes inside the async task have no rollback if the outer transaction fails.
- **Fix:** The async crawl task should be a separate `@Transactional` service method called after the outer transaction commits. Use `@TransactionalEventListener(phase = AFTER_COMMIT)` or move crawl to a RabbitMQ task queue (preferred — consistent with the async architecture).

---

### TASK-011 — `spring-boot-starter-webflux` not approved in TECH-STACK.md
- **Status:** `[x] DONE`
- **File:** `pom.xml`, `infrastructure/meta/MetaApiClient.java`, `infrastructure/claude/ClaudeApiClient.java`
- **Bug:** WebClient (from webflux) is used for all HTTP calls but `spring-boot-starter-webflux` is not in TECH-STACK.md.
- **Fix (if rejected):** Replace `WebClient` with Spring 6.1 `RestClient` (no extra dep, included in spring-boot-starter-web). If approved: add to TECH-STACK.md + CLAUDE.md changelog.

---

### TASK-012 — ClickHouse layer not wired up *(pending C2 decision)*
- **Status:** `[x] DONE`
- **Issue:** Architecture spec's Resolved Decisions says analytics consolidated to MySQL (no ClickHouse). But CLAUDE.md says ClickHouse for analytics only. ClickHouse entities exist in code. `clickhouse-jdbc` is in approved TECH-STACK.md but absent from `pom.xml`. The analytics pipeline is in an undefined state.
- **Fix (if MySQL wins):** Remove ClickHouse entities and repos. Keep analytics tables in MySQL (already designed in spec). Remove `clickhouse-jdbc` from TECH-STACK.md.
- **Fix (if ClickHouse wins):** Add `clickhouse-jdbc` to `pom.xml`. Wire ClickHouse `DataSource`. Migrate analytics write path.

---

## HIGH — Missing Infrastructure

### TASK-013 — `knowledge-index.json` does not exist
- **Status:** `[x] DONE`
- **Location:** Should be at `D:\Meta business agents\knowledge-index.json` (referenced in CLAUDE.md as required before touching any file)
- **Bug:** Bible rule #1: "Query `docs/knowledge-index.json` before opening any file." The file does not exist. The first rule of the bible cannot be followed.
- **Fix:** Create `knowledge-index.json` with a flat index of all current files: path, purpose, domain, last-modified. Update after every approved change.

---

### TASK-014 — No Flyway migrations exist
- **Status:** `[x] DONE`
- **Location:** `backend/src/main/resources/db/migration/` — directory does not exist
- **Bug:** Bible: schema changes via Flyway only, never manual. No migrations means schema is undefined — the application cannot start cleanly against a fresh DB.
- **Fix:** Create migrations for all current entities:
  - `V1__create_core_schema.sql` — accounts, users, refresh_token_families
  - `V2__create_agent_schema.sql` — agents, agent_faq, agent_skill, agent_file, agent_website, agent_website_pages
  - `V3__create_conversation_schema.sql` — conversations, messages, webhook_raw
  - `V4__create_analytics_schema.sql` — webhook_events, conversation_sessions, agent_performance_hourly (MySQL)
  - Schema must match architecture spec Section 4 exactly (RESTRICT FKs, soft deletes, TSID PKs)

---

### TASK-015 — TSID ID strategy not verified
- **Status:** `[x] DONE`
- **Bug:** Entities use `@GeneratedValue` — unclear if TSID strategy is wired. Bible: TSID (not UUID), configured via `NODE_ID` env var per instance.
- **Fix:** Verify `@GeneratedValue` strategy uses a TSID generator. If not: implement `TsidIdentifierGenerator` implementing Hibernate's `IdentifierGenerator`. Wire via `@GenericGenerator`. Add startup assertion: fail if `NODE_ID` env var is not set or is out of range 0–1023.

---

### TASK-016 — Bcrypt cost factor not verified
- **Status:** `[x] DONE`
- **File:** `common/security/SecurityService.java`
- **Bug:** `BCryptPasswordEncoder` is used but cost factor is not confirmed to be 12. Bible and architecture spec both require explicit cost 12.
- **Fix:** Instantiate as `new BCryptPasswordEncoder(12)` explicitly. Add startup assertion: log `WARN` if `BCRYPT_COST` env var is missing (cannot introspect encoder after construction). Architecture spec: add `BCRYPT_COST=12` to required env vars.

---

### TASK-017 — Redis DB0 / DB1 separation not configured
- **Status:** `[x] DONE`
- **Bug:** Bible: Redis DB0=cache, DB1=security state (JWT blacklist, lockout flags). No Redis config file found with this separation. Security state and cache may share the same DB — cache eviction could evict security entries.
- **Fix:** Configure two `RedisTemplate` beans: one using database index 0 (cache), one using database index 1 (security). Inject the correct template in each service by qualifier.

---

## MEDIUM — Code Quality

### TASK-018 — JwtService returns `null` on missing claims
- **Status:** `[x] DONE`
- **File:** `common/security/JwtService.java → extractAccountId()`, `extractUserId()`
- **Bug:** Returns `null` on missing claims. Bible: no null returns from service layer.
- **Fix:** Return `Optional<Long>`. Update callers to handle `Optional`.

---

### TASK-019 — `spring-boot-starter-actuator` missing from pom.xml
- **Status:** `[x] DONE`
- **Bug:** `spring-boot-starter-actuator` is in the approved TECH-STACK.md but absent from `pom.xml`. Health endpoints, metrics, and Prometheus scraping are non-functional.
- **Fix:** Add `spring-boot-starter-actuator` to `pom.xml`. Configure `management.endpoints.web.exposure.include=health,prometheus` in `application.yml`.

---

## POST-AUDIT IMPROVEMENTS

### TASK-022 — Write tests for all core business logic
- **Status:** `[x] DONE — 2026-07-19`
- **Test infrastructure created:**
  - `support/IntegrationTestBase.java` — Testcontainers MySQL + Redis, @MockBean MetaApiClient + ClaudeApiClient
  - `src/test/resources/application-test.yml` — test profile, bcrypt cost=4, test JWT keys
  - `pom.xml` — Surefire NODE_ID env var, testcontainers-redis dependency
- **Unit tests (no Spring context):**
  - `InboundMessageParserTest` — 5 tests: valid payload, no messages, empty JSON, malformed, image type
  - `MetaMessageSenderTest` — 4 tests: success, no message ID, API throws, payload shape
  - `TsidGeneratorTest` — 4 tests: positive ID, uniqueness (1000 calls), ascending order, throws without NODE_ID
- **Integration tests (Testcontainers MySQL + Redis):**
  - `AgentDeployServiceTest` — 6 tests: deploy success, Meta API called correctly, already active, pause, Meta fails (DB unchanged), wrong account
  - `AgentServiceTest` — 5 tests: create agent, ineligible phone, add FAQ, add skill, delete missing FAQ
  - `ConversationServiceTest` — 6 tests: inbound message persisted, new conversation, reuse conversation, marked processed, marked failed, graceful no-op
  - `ConversationStoreTest` — 4 tests: create conversation, dedup conversation, save inbound, save outbound
  - `AuthControllerTest` — 10 tests: register, missing email, access token cookie, refresh token cookie, no tokens in body, wrong password, unknown user, 401 without cookie, 200 with cookie, logout clears cookies
- **Corrections found and fixed during test writing:**
  - `Agent` entity was missing `Status` enum, `status` field, `deployedAt` — added
  - Flyway V3 had wrong table name (`agents` vs `agent`) — fixed
  - Flyway V6 created for `status` + `deployed_at` columns
  - Login failures return 400 (BusinessException) not 401 — tests corrected to match real contract

### TASK-021 — Remove Claude from message pipeline + build Meta deploy pipeline
- **Status:** `[x] DONE — 2026-07-19`
- **Root cause:** Claude was running in the webhook pipeline. Meta's AI handles all customer replies natively — we are the configuration layer, not the execution layer.
- **AgentRunner.java** — deleted
- **ConversationService.java** — Claude, SearchService removed. Pipeline now: parse → persist → analytics. 60 lines.
- **AgentService.java** — fixed wrong settings payload format (was flat, must be nested per spec). Removed local website crawl (Meta crawls natively).
- **AgentDeployService.java** — created. `deploy()` and `pause()` call `PUT /agent_config/settings` with `rollout.enabled` true/false. Meta API first, DB second.
- **AgentController.java** — wired `POST /{id}/deploy` and `POST /{id}/pause`
- **ClaudeApiClient.java** — `generate()` method added for wizard use only. `generateReply()` made private. Comment added: never call in message pipeline.

### TASK-020 — Split ConversationService into focused collaborators
- **Status:** `[x] DONE — 2026-07-19`
- **Files created:**
  - `domain/conversation/model/InboundMessage.java` — typed record replacing null-returning JsonNode
  - `domain/conversation/service/InboundMessageParser.java` — parses raw Meta JSON → `Optional<InboundMessage>`
  - `domain/conversation/service/ConversationStore.java` — all DB reads/writes for conversations and messages
  - `domain/conversation/service/AgentRunner.java` — RAG + system prompt + Claude call. No DB writes. No @Transactional.
  - `domain/conversation/service/MetaMessageSender.java` — sends to Meta, returns confirmed ID, never returns null
- **ConversationService.java** — now a thin coordinator. External I/O (Claude, Meta) moved outside @Transactional.
- **Fixed:** `@Transactional` no longer wraps Claude API call. UUID fallback removed. Null returns eliminated.

---

## Execution Order

```
Phase 1 — Resolve conflicts (no code until decided)
  C1: JWT transport mechanism
  C2: Analytics DB (MySQL vs ClickHouse)
  C3: webflux approval

Phase 2 — Runtime crash fixes (nothing works without these)
  TASK-001: systemPrompt on Agent
  TASK-002: SecurityContext in RabbitMQ thread

Phase 3 — Security (cannot go to staging with these open)
  TASK-003: JWT httpOnly cookie (after C1)
  TASK-004: Hardcoded verify token
  TASK-005: Empty Claude API key default
  TASK-006: account_id on 5 child entities

Phase 4 — Infrastructure (needed for any real deploy)
  TASK-013: knowledge-index.json
  TASK-014: Flyway migrations
  TASK-015: TSID strategy
  TASK-016: Bcrypt cost 12
  TASK-017: Redis DB separation

Phase 5 — Architecture quality
  TASK-007: Raw SQL in AnalyticsService
  TASK-008: Raw SQL in SearchService
  TASK-009: Analytics tenant isolation
  TASK-010: CompletableFuture escaping transaction
  TASK-011: webflux approval (after C3)
  TASK-012: ClickHouse wiring (after C2)

Phase 6 — Code quality
  TASK-018: JwtService null returns
  TASK-019: Actuator missing
```

---

## MESSAGING STACK — Production Readiness (2026-07-20)

> Source: EM analysis (task a1f51091d20649fe9) + EL spec (task acb60fbc424825b6c)
> Every task below goes through full PM + EM + EL maker-checker. No exceptions.

### DECISION — D1: Outbound message record strategy
- **Status:** `[x] RESOLVED — Option A`
- **Question:** Meta sends AI replies directly to customers. We never send through our server. Should we record outbound messages?
- **Option A:** Create outbound message record on first status receipt (`sent`). Subsequent `delivered`/`read` statuses update that record. Full conversation history visible.
- **Option B:** Do not store outbound messages. Only track status events as metadata.
- **Decision:** **Option A.** Businesses need to see what the agent said, not just delivery receipts. Incomplete conversation history breaks the core value proposition.
- **Impact on TASK-026:** `saveOutbound()` is called when `sent` status arrives, not proactively.

---

### TASK-023 — EL Correctness: @Transactional on private methods silently ignored
- **Status:** `[ ] TODO`
- **Priority:** P0-correctness (fix before any other messaging stack task)
- **File:** `domain/conversation/service/ConversationService.java`
- **Bug:** `markProcessing()`, `markProcessed()`, `markFailed()` are `private @Transactional`. Spring CGLIB cannot proxy private methods — `@Transactional` is silently ignored. DB writes in these methods have no transaction boundary.
- **Fix:** Remove `private` keyword from all three methods. Package-private is sufficient for Spring CGLIB.
- **EL spec:** Change `private WebhookRaw markProcessing(...)` → `WebhookRaw markProcessing(...)` for all three.

---

### TASK-024 — Webhook signature verification (X-Hub-Signature-256)
- **Status:** `[ ] TODO`
- **Priority:** P0-security (closes attack surface before any real traffic)
- **File:** `domain/webhook/controller/WebhookController.java` (POST handler)
- **Bug:** Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hmac>`. We never verify it. Any actor can POST arbitrary payloads to `/webhook` and inject fake messages or status events.
- **Fix:**
  1. Read `X-Hub-Signature-256` header in `WebhookController.handleInbound()`
  2. Compute `HMAC-SHA256(appSecret, requestBody)` — app secret from `${meta.webhook.app-secret}` (new config property)
  3. Constant-time compare (`MessageDigest.isEqual`) — reject with 403 on mismatch
  4. Add `meta.webhook.app-secret` to `application.yml` required properties (no default)
  5. Verification must happen before the payload enters the queue

---

### TASK-025 — Idempotency guard on webhook processing
- **Status:** `[ ] TODO`
- **Priority:** P0 (data integrity — duplicate delivery corrupts message table)
- **File:** `domain/conversation/service/ConversationService.java`, `domain/webhook/repository/WebhookRawRepository.java`
- **Bug:** `markProcessing()` is not atomic. Two RabbitMQ consumers can both read `PENDING`, both write `PROCESSING`, both proceed. Meta's at-least-once delivery guarantee means duplicates will occur.
- **Fix (EL spec):**
  1. `WebhookRawRepository`: add `@Modifying @Query("UPDATE WebhookRaw w SET w.status = 'PROCESSING' WHERE w.id = :id AND w.status = 'PENDING'") int claimForProcessing(@Param("id") Long id)`
  2. `ConversationService.markProcessing()`: call `claimForProcessing()` — if returns 0, log debug + return null
  3. `processWebhookEvent()`: if `markProcessing()` returns null, return immediately (idempotent skip)
- **Depends on:** TASK-023 (private @Transactional fix must be in place first)

---

### TASK-026 — Status webhook processing (delivered/read/failed receipts)
- **Status:** `[ ] TODO`
- **Priority:** P0 (without this, message.status never updates; outbound records don't exist)
- **Files:** `ConversationService.java`, `ConversationStore.java`, `MessageRepository.java`
- **New files:** `domain/conversation/model/StatusUpdate.java`, `domain/conversation/service/StatusUpdateParser.java`
- **Bug:** Status webhooks (`value.statuses[0]`) return `Optional.empty()` from `InboundMessageParser` (no `messages` array). `processWebhookEvent` calls `markProcessed` and returns. Status silently discarded. `saveOutbound()` never called — outbound records never created.
- **Fix (EL spec):**
  1. New `StatusUpdate` record: `metaMessageId`, `status`, `recipientPhone`
  2. New `StatusUpdateParser`: navigates `entry[0].changes[0].value.statuses[0]`
  3. `ConversationStore.updateMessageStatus(metaMessageId, Status)`: find message by `meta_message_id`, update status
  4. `MessageRepository`: add `Optional<Message> findByMetaMessageId(String)`
  5. `ConversationService.processWebhookEvent()`: when `inboundParser.parse()` returns empty, try `statusUpdateParser.parse()` — if status=`sent`, create outbound record via `saveOutbound()`; if `delivered/read/failed`, call `updateMessageStatus()`
  6. `resolveMessageStatus()` private method: switch on Meta string → `Message.Status` enum; unknown values → warn + null (skip, no exception)
- **Depends on:** TASK-025, D1 decision (Option A confirmed above)

---

### TASK-027 — EL Correctness: touchLastMessageAt race + redundant write
- **Status:** `[ ] TODO`
- **Priority:** P1 (two DB round-trips where one suffices; minor race between them)
- **File:** `domain/conversation/service/ConversationStore.java`, `domain/conversation/service/ConversationService.java`
- **Bug:** `touchLastMessageAt()` updates `conversation.lastMessageAt` in one transaction. `saveInbound()` runs immediately after in a separate transaction. Two round-trips, no atomicity guarantee between them.
- **Fix (EL spec):**
  1. Update `conversation.lastMessageAt` inside `saveInbound()` — same transaction, no separate method
  2. Remove `touchLastMessageAt()` from `ConversationStore`
  3. Remove `conversationStore.touchLastMessageAt()` call from `ConversationService.processWebhookEvent()`

---

### TASK-028 — Non-text message type support
- **Status:** `[ ] TODO`
- **Priority:** P1 (customers sending images/audio/documents are currently invisible to businesses)
- **Files:** `InboundMessage.java`, `InboundMessageParser.java`, `ConversationStore.java`, `ConversationService.java`
- **Bug:** `InboundMessageParser.extractText()` returns placeholder string for non-text types. `contentType` on `Message` is always `text`. `contentJson` (rich metadata column) never populated.
- **Fix (EL spec):**
  1. `InboundMessage` record: add `messageType` (String) and `contentJson` (String) fields
  2. `InboundMessageParser.parse()`: set `type` from message node; `textBody` only for `type=text`; `contentJson = messageNode.toString()` for non-text; remove `extractText()` method
  3. `ConversationStore.saveInbound()`: add `contentType` and `contentJson` params to signature + builder
  4. `ConversationService`: `resolveContentType(metaType)` private method → switch to `Message.ContentType` enum
  5. `interactive` type: NOT adding new enum value (requires migration) — falls through to `text` default, `contentJson` captures full payload; log warn
- **Depends on:** TASK-026 (signature change to `saveInbound` will be coordinated)

---

### TASK-029 — Dead-letter queue on `webhook.raw` RabbitMQ queue
- **Status:** `[ ] TODO`
- **Priority:** P1-infra (poison messages stall the queue without DLQ; config-only change)
- **File:** RabbitMQ config bean (location TBD — check `config/` or `infrastructure/rabbitmq/`)
- **Bug:** If `WebhookListener` throws uncaught exception on a malformed payload, RabbitMQ requeues the message indefinitely. One bad payload can stall the entire queue or spin a CPU core.
- **Fix:**
  1. Configure DLQ: `webhook.raw.dlq` exchange + queue bound with `x-dead-letter-exchange` on `webhook.raw`
  2. Set `x-message-ttl` on DLQ (e.g., 7 days) — prevent unbounded DLQ growth
  3. Alert on DLQ depth > 0 in Grafana
  4. No automatic retry from DLQ — manual replay only (prevents bad payload loops)

---

### TASK-030 — Analytics event error handling in processWebhookEvent
- **Status:** `[ ] TODO`
- **Priority:** P1 (analytics failure must not roll back message persistence)
- **File:** `domain/conversation/service/ConversationService.java`
- **Bug:** `publishAnalyticsEvent()` is called after `markProcessed()` with no try/catch. If analytics throws (Kafka down, queue full, serialization error), behavior depends on transaction scope. Message persistence may be rolled back for a non-critical analytics failure.
- **Fix:** Wrap `publishAnalyticsEvent()` call in try/catch. On exception: log warn with event details, do not rethrow. Message persistence is authoritative — analytics failures are non-fatal.

---

### TASK-031 — conversations table account_id index
- **Status:** `[ ] TODO`
- **Priority:** P1 (prevents full table scan on every conversation list query at scale)
- **File:** New Flyway migration (next version after current highest V)
- **Fix:** `ALTER TABLE conversations ADD INDEX idx_conversations_account_id (account_id)` — verify no existing composite index already covers this access pattern before adding.

---

### TASK-032 — webhook_raw retention/cleanup job
- **Status:** `[ ] TODO`
- **Priority:** P1 (30-day window before disk impact on t3.medium; Grafana disk alert is interim safety net)
- **Files:** New `WebhookRetentionJob.java`, `WebhookRawRepository.java`
- **Fix (EL spec):**
  1. `WebhookRawRepository`: add `@Modifying @Query("DELETE FROM WebhookRaw w WHERE w.status IN ('PROCESSED', 'FAILED') AND w.processedAt < :cutoff") int deleteProcessedBefore(@Param("cutoff") LocalDateTime cutoff)`
  2. `WebhookRetentionJob`: `@Scheduled(cron = "0 0 2 * * *")` — purge rows older than 30 days
  3. Retention window: `@Value("${webhook.retention.days:30}")` — config-driven, not hardcoded
  4. Ensure `@EnableScheduling` is present in app config
  5. Add Grafana disk usage alert before this ships as interim protection

---

## Execution Order — Messaging Stack

```
TASK-023: Fix @Transactional private methods     (P0-correctness, must be first)
TASK-024: Webhook signature verification          (P0-security, closes attack surface)
TASK-025: Idempotency guard                       (P0, prevents data corruption)
TASK-026: Status webhook + outbound records       (P0, completes conversation history)
TASK-027: touchLastMessageAt race fix             (P1, cleanup — do with TASK-026)
TASK-028: Non-text message types                  (P1, after TASK-026 saveInbound sig change)
TASK-029: RabbitMQ DLQ config                    (P1-infra, config only)
TASK-030: Analytics error handling               (P1, small safety fix)
TASK-031: conversations account_id index         (P1, single migration)
TASK-032: webhook_raw retention job              (P1, 30-day window)
```

---

## PRODUCT BACKLOG — Founder priorities (2026-07-22)

> Direct from founder. Product-forward: prove the core, then the wizard gaps.

| P | Item | Notes |
|---|---|---|
| ~~P0~~ | ~~E2E Meta validation~~ | **DONE 2026-07-22** — Real WhatsApp "Hi" landed in webhook_raw (account 867344590959546368, agent 723456789012345678). Callback URL live: https://app.karix.online/api/v1/webhook. App 2208485319518262 subscribed to WABA 494227720434920. |
| P1 | Deployment visibility + override guard | Dashboard: deployed/paused per agent AND per phone. Deploying to occupied phone = explicit "replaces Agent X" confirm, never silent override. Backend has status/deployedAt. |
| P1 | AI-written skills/behavior | Extend wizard generate-defaults pattern (Claude wizard-time, already approved) to skills: one-sentence description → Claude drafts → user edits. |
| P1 | Guided journey creation | Assist across full setup journey, not just fragments. |
| P2 | Fix pre-existing test suite interference (follow-up #4) | Surfaced in 2026-07-22 local run: AgentServiceTest 9/9 errors, ConversationServiceTest 6/6, etc. Parked per founder. |

---

## AUDIT FOLLOW-UPS (2026-07-22)

> Numbered list from the 2026-07-22 design/audit session. Persisted here so it never has to be re-derived.

| # | Item | Status |
|---|---|---|
| 4 | Test suite interference | `[ ] TODO` |
| 5 | AppShell de-genericize (breadcrumb chevron, wordmark logo) | `[ ] TODO` |
| 6 | Backend hardening → TASK-033 | `[x] DONE` |
| — | CI pipeline (makes audits permanent) | `[ ] TODO` |

---

### TASK-033 — Backend hardening: rate limit + tenant leak + dead code + tests
- **Status:** `[x] DONE — 2026-07-22` (PM APPROVED, EM APPROVED, EL APPROVE after 1 REJECT)
- **B — Analytics tenant leak (HIGH):** `AnalyticsService` verified agent ownership only when hourly rows existed — empty-data path let any tenant probe any agentId (and leak session counts). Fixed: `verifyAgentOwnership()` via `AgentRepository.findByIdAndAccountId` runs before any query, fails closed with `NotFoundException`.
- **A — Rate limiting:** New `RateLimitFilter` (Redis DB0, fixed-window INCR+EXPIRE, fail-open if Redis down, 429 + Retry-After + ApiResponse envelope). Limits in `application.yml` (`ratelimit.*`): register 10/h/IP, login 20/15min/IP, refresh 30/min per hashed refresh-token cookie, generate-defaults 10/h/IP (Claude cost bound). No new dependency — Redis rate limiting already in TECH-STACK.md.
- **C — Dead code:** `SearchService` deleted (no callers since Meta-native AI decision 2026-07-19) + both unused `fullTextSearch` repo queries.
- **D — Tests (6 new classes):** RateLimitFilterTest (7), AnalyticsServiceTest (cross-tenant + empty-data-bypass regression), WabaServiceTest, StatusUpdateParserTest (8), WebhookControllerSignatureTest (5), WebhookRetentionJobTest (5).
- **EL rejection round:** Agent.Status.live→active, MockHttpServletRequest servletPath fix, lenient() stubbing.
- **Deferred (EL advisory):** default secrets in application.yml (`MetaAgent@2024!` etc.) violate no-default-secrets — pre-existing, log as TASK-034.
- **NOT yet verified by execution:** no local Maven/Java — compile + test run must happen on the dev server before deploy.

### TASK-035 — Webhook single-URL multi-tenant routing (founder correction)
- **Status:** `[x] DONE — 2026-07-22` (PM APPROVED, EM APPROVED, EL APPROVE, 7/7 tests green locally)
- **Why:** Founder: one Meta App = ONE callback URL for all customers. Old `/{accountId}` path was both wrong (can't configure per-tenant URLs in Meta) and a security hole (attacker-controlled accountId).
- **Fix:** `WebhookController` now GET/POST `/api/v1/webhook` (no path var). Tenant resolved from payload `entry[0].changes[0].value.metadata.phone_number_id` → `AgentRepository.findByPhoneNumberId` → account. Unattributable payloads: WARN + 200 drop (Meta retry-loops on non-200). Signature verification unchanged, runs first.
- **Tests:** WebhookControllerSignatureTest expanded to 7 (adds tenant-resolution persist + unattributable-drop).
- **Meta App config values:** callback URL `https://app.karix.online/api/v1/webhook`, verify token `MetaAgentVerifyToken2024` (server).
- **NOT deployed yet** — dev server still runs old controller; deploy needed before E2E.

### TASK-034 — Remove default secrets from application.yml
- **Status:** `[ ] TODO` (EL advisory from TASK-033)
- **File:** `backend/src/main/resources/application.yml` — `DB_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD` have hardcoded fallback values. Bible: no defaults for secrets. Remove defaults; app must fail fast if env vars missing. Coordinate with server env before deploying.

---

### TASK-036 — Human handoff toggle + Thread Control release (stopgap)
- **Status:** `[x] DONE — 2026-07-22` (PM+EM APPROVED batched, EL APPROVE independent)
- **Why:** Meta hardcoded `handoff.enabled=false` on every deploy — agents could never hand off to a human. Founder wanted a simple per-agent toggle + manual "release back to AI" button as a stopgap, ahead of full third-party live-agent integration.
- **Backend:** `Agent.handoffEnabled`/`handoffMessage` fields (`V12__add_handoff_fields_to_agent.sql`), `AgentDeployService.putSettings` sends real values instead of the old hardcoded `false`. New `ThreadControlClient` (separate from `MetaApiClient` — different base URL, v1.0.0 not v2.0.0, requires Bearer header + access_token + oauth_token query params, all three per `docs/meta-api/thread-control.md`). New `POST /agents/{id}/thread-control/release`.
- **Frontend:** Human Handoff toggle + message field in `AgentDetailPage.tsx` settings; "Thread Control" button (visible when `status===active && handoffEnabled`) with confirm modal, matching the existing delete-agent pattern.
- **Note:** `AgentService.java:138`'s `handoff.enabled=false` in `bindPhone`'s initial provisioning step is intentional (agent hasn't configured handoff yet), not a bug — EL confirmed.

### TASK-037 — Webhook standby/handoff parser scaffold
- **Status:** `[x] DONE — 2026-07-22` (PM+EM APPROVED batched, EL REJECT → fix → EL APPROVE)
- **Why:** Detect when Meta's AI hands a conversation to a human, per the real observed signal in `docs/meta-api/webhook-standby-handoff.md` (standby-wrapper presence/absence — NOT a `messaging_handovers` field, which was confirmed to not exist in real traffic).
- **Fix:** New `HandoffClassifier` (pure function, `HandoffSignal` enum: BIZAI_ACTIVE/NEEDS_HUMAN/STATUS_UPDATE/UNRECOGNIZED), wired into `ConversationService.processWebhookEvent`. `Conversation.needsHuman` field (`V13__add_needs_human_to_conversation.sql`). Explicitly provisional — flagged in code comments and logs since it's based on one sample payload capture, not yet verified against production traffic.
- **EL rejection round:** (1) migration version collision — this task's migration was originally V11, collided with TASK-038's V11; renamed to V13. (2) `classify()` was called twice redundantly on the same raw payload; consolidated to one call, result reused.
- **Explicitly out of scope:** no auto-action wired to `needsHuman` — `notifyHandoverTarget()` is an empty stub marking the future third-party integration seam.
- **Not yet verified by execution:** Maven unavailable in build environment; never compiled or test-run, only reviewed manually + via EL.

### TASK-038 — Client entity + staff access (backend only)
- **Status:** `[x] DONE — 2026-07-22` (PM+EM APPROVED batched — real schema decision made: shared resources update live, no forking, audit trail from day one; EL APPROVE)
- **Why:** Clients (and their WABAs) can be shared between internal staff — not exclusively owned by one operator. Needed a real entity (not a view) since Meta API calls key off it.
- **Fix:** `Client`, `ClientStaff` (many-to-many join, not `owner_id`), `ClientAuditLog` entities (`V11__create_client_and_staff_access.sql`). `ClientService.verifyStaffAccess()` mirrors `AnalyticsService`'s fail-closed tenant convention exactly (confirmed by EL, not just similarly named). Phone numbers/health NOT duplicated — resolved live via `WabaService.getPhones()` through the client's linked WABA record.
- **API:** `POST/GET /clients`, `GET/PUT /clients/{id}`, `GET /clients/{id}/phones`, `GET /clients/{id}/audit-log`, `POST/DELETE /clients/{id}/staff`.
- **EL follow-ups (non-blocking, logged not fixed):** TOCTOU race possible in `removeStaffAccess` between read and delete of the last two staff grants (acceptable at current scale — see TASK-039). N+1 query in `ClientController.toStaffResponse` (per-staff `findById` in a loop) — fine until staff-per-client lists grow.
- **Frontend NOT built** — Profile/Customer UI is a separate, later task depending on this API.

### TASK-039 — Follow-ups from TASK-038 EL review (not blocking, log for later)
- **Status:** `[ ] TODO`
- **Items:** (1) `ClientService.removeStaffAccess` — no row lock between the last-staff-grant check and delete; two concurrent removals against the last two grants could both pass, leaving a client with zero staff. (2) `ClientController.toStaffResponse` — per-staff `userRepository.findById` in a stream loop; switch to a batch `findAllById` if client staff lists grow beyond a handful.

### TASK-040 — Follow-up from Dashboard/Agents EL review (not blocking)
- **Status:** `[ ] TODO`
- **Item:** `AgentsPage.tsx`'s `agentHealth()` and `DashboardPage.tsx`'s `triage()` independently encode the same draft/paused/disconnected "needs attention" rule with different precedence ordering. Extract to one shared function before a third page needs the same logic, so the two definitions don't silently drift apart.

### TASK-041 — Fix: agent delete 500 on child data (cascade hard-delete)
- **Status:** `[x] DONE — 2026-07-27` (PM+EM APPROVED batched w/ one re-review round, EL APPROVE independent)
- **Bug:** Deleting an agent with any child row (FAQ/skill/file/website, and by schema conversations/messages/webhook_raw) threw unhandled 500 — `ON DELETE RESTRICT` FK constraints (confirmed via real Selenium E2E repro + backend log `ConstraintViolationException` on `fk_faq_agent`).
- **Options weighed:** (A) cascade hard-delete, (B) soft-delete via existing `agent.status='deleted'` enum value, (C) catch-and-4xx leaving RESTRICT in place. Chose **A**: no compliance/audit-retention requirement found for conversation data (checked knowledge-index/TASKS.md/memory); matches existing, accurate Danger Zone UI copy ("permanently deletes... all its data"); unblocks the common real case (draft agent + 1 FAQ) that C leaves broken; B is a bigger, unscoped change (query filtering everywhere agent status is read) for a bug-fix task.
- **Fix:** `AgentService.deleteAgent()` (`backend/src/main/java/.../agent/service/AgentService.java:203-217`) now deletes child rows in FK-safe order (website pages → websites → faqs → skills → files → messages → conversations → webhook_raw) inside the existing single `@Transactional` boundary, then deletes the agent. New `deleteAllByAgentId`/`deleteAllByWebsiteId` repo methods on `AgentFaqRepository`, `AgentSkillRepository`, `AgentFileRepository`, `AgentWebsiteRepository`, `AgentWebsitePageRepository`, `MessageRepository`, `ConversationRepository`, `WebhookRawRepository`.
- **Verified:** `mvn -o compile` clean. Live curl against running local backend (real MySQL, real RESTRICT constraints — not mocked): register → login → create draft agent → add FAQ → `DELETE /agents/{id}` → **200** (was 500 before fix) → `GET /agents/{id}` → 404 confirms removal.
- **PM/EM re-review condition met:** curl smoke test actually executed with captured output (not just asserted); single-transaction/no-nested-propagation confirmed by inspection.
- **Follow-up logged (not blocking this fix, but flagged pre-production-launch):** Danger Zone delete confirm has no disclosure of child-record counts (conversations/messages/FAQs etc.) before the irreversible action fires — PM: this is a trust risk once real conversation history exists, independent of any compliance mandate. See TASK-042.

### TASK-042 — Follow-up: Danger Zone delete needs child-record count disclosure
- **Status:** `[ ] TODO` — flagged pre-production-launch blocking, not indefinitely deferrable
- **Item:** `AgentDetailPage.tsx` Danger Zone delete confirmation shows generic copy only. Before an irreversible cascade delete fires, show what will actually be destroyed (conversation count, message count, FAQ/skill/file/website count, last-activity date) so an operator isn't surprised that "permanently deletes... all its data" included months of real customer conversation history.

---

### TASK-044 — Verify OAuth2 connector auth_config nesting live
- **Status:** `[ ] OPEN` (flagged by EM gate 2026-07-28, ships now as reversible/cheap but unconfirmed)
- **Item:** `AddConnectorModal`'s `auth_type: API_KEY` payload was found broken live (Meta 400: "auth_config.api_key is required") — fixed by nesting under `auth_config.api_key`. The `OAUTH2_CLIENT_CREDENTIALS` branch was given the same type-named-wrapper treatment (`auth_config.oauth2_client_credentials`) by symmetry only — `docs/meta-api/connectors.md` doesn't show the top-level wrapper key for either auth type, and no OAuth connector has been tested against real Meta this session. Test creating an OAuth2 connector for real before treating this path as confirmed working.

### TASK-043 — SkillRequest doesn't validate Meta's title format server-side
- **Status:** `[ ] OPEN` (flagged by PM+EM gate 2026-07-28, out of scope for the Skills UI task that surfaced it)
- **Item:** `SkillRequest.java` validates title `@Size(max=64)` but has no `@Pattern` enforcing Meta's real constraint (lowercase, numbers, hyphens only, no leading/trailing hyphen — e.g. `greeting-skill`). A title violating this format only fails when it reaches Meta (real 400), not at our own validation layer. Frontend-only regex (added in the Skills UI) reduces this but doesn't close it — a direct API caller or a client bug could still submit an invalid title. Add `@Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$")` to `SkillRequest.title`.

### TASK-047 — ClientService still checks WABA ownership the pre-decoupling way
- **Status:** `[ ] OPEN` (flagged by EL 2026-07-28, out of scope for the decoupling batch that surfaced it)
- **Item:** `ClientService.java:49,102` calls `wabaRepository.findByIdAndAccountId` (exact single-account match). This is inconsistent with the 2026-07-28 Agent/WABA ownership decoupling (see `waba_account_access`, `WabaAgentReconciliationService`, `PhoneNumberAccessGuard`) — Client's own WABA-access check should likely go through the same `waba_account_access` grant model instead of exact `accountId` equality.

---

### TASK-045 — Connector name "shopifycartconnector" gets a Meta 500 (unexplained)
- **Status:** `[ ] OPEN` (worked around, root cause not found — see 2026-07-28/29 MDH Spices Selenium deployment)
- **Item:** Creating a connector with the exact name `shopifycartconnector` on phone number 1103393549522539 returns a bare `500 Internal Server Error` from Meta with no detail in the response body, every time, with an otherwise-valid payload (confirmed identical payload succeeds instantly under any other name, e.g. `shopifycartconnector_v2`, `shopifycartconnector_mdh`). No connector with that name shows up in our own `GET agent_connectors` list (confirmed after fixing TASK's list-deserialization bug), so it isn't a duplicate visible to us — likely a name collision with something in Meta's shared sandbox outside our account, or an undocumented Meta-side reserved/blocked name. Deployed MDH Spices' Shopify connector as `shopifycartconnector_mdh` instead (functionally identical — referenced by ID everywhere, never by name). If this resurfaces for a different name, escalate to Meta support rather than re-diagnosing locally — our side has been fully verified correct (payload shape, auth_config nesting, connectors/tools list fix).

### TASK-046 — WABA-shared Skills/FAQs/Connectors (design refined, spec not started)
- **Status:** `[x] SUPERSEDED — 2026-07-29 by TASK-050.` The "live fan-out to every agent on edit" model this task describes was replaced by a simpler, safer design: editing a Library item never pushes to Meta automatically — every agent shows it as "Out of sync" until that agent is explicitly synced. This eliminates the cross-agent partial-failure problem this task was blocked on. See TASK-050 for the shipped first slice (Skills only).
- **Item:** Founder wants Skills/FAQs/Connectors consolidated at the WABA level — one shared definition per WABA, edits apply live to every agent using it, mirroring Meta Business Suite's own grouped-nav pattern (parent + sub-items). EM verified this is NOT achievable as a thin Meta-API proxy: `Agent.phoneNumberId` is unique per agent in our DB, and Meta's own Skill/FAQ/Connector objects are scoped to a single phone_number_id/agent_id — there is no WABA-level object on Meta's side.
- **Ownership model (refined, founder's own design 2026-07-29):** don't use a separate membership/join table — give `Skill` (and `Faq`/`Connector`) a **nullable `waba_id`** column, exactly mirroring the existing `Agent.wabaId` pattern (nullable FK, access derived via `waba_account_access`/`PhoneNumberAccessGuard` — same query shape as "does this account see this Agent"). `waba_id IS NULL` = account-private Skill, not shared with anyone, no WABA yet. `waba_id` set = shared live across every Agent where `Agent.wabaId` matches. This is simpler than EM's original join-table idea and reuses a pattern already proven in this codebase.
- **Still unresolved, blocks code:** the fan-out-write problem is untouched by the ownership-model fix. Editing a WABA-level Skill still requires pushing the write out to every member agent's real Meta-side `agent_config/skills` — partial-failure handling (agent 3 of 5 fails the Meta write: rollback everywhere, or does that one agent silently drift out of sync?) has no answer yet. PM also flagged: editing a shared Skill could silently change another agent's behavior on a live WhatsApp number — should the editor show "shared with N agents" before save?
- **Migration approach (founder decision 2026-07-29): manual promote, not auto-merge.** Existing Skills live only on Meta today (no DB row at all, confirmed thin-proxy). On ship, each agent's current Skills import as-is (read-only, agent-scoped, `waba_id = NULL`) — a human explicitly "Promotes to WABA-level" per skill; nothing auto-collapses agents' skills into one WABA row even if they look byte-identical today (rejected explicitly — risk of silently merging skills meant to diverge later).
- The nav-only slice (grouped Agents sub-nav: Knowledge Base/Skills/Connectors, still agent-scoped) shipped 2026-07-29 independent of this — see `AppShell.tsx`.

### TASK-050 — Skill Library, first slice (supersedes TASK-046)
- **Status:** `[x] DONE — 2026-07-29` (PM+EM APPROVED with 2 conditions, both resolved by founder; EL review pending)
- **What shipped:** `skill` table (nullable `waba_id`, mirrors `Agent.wabaId`'s existing access pattern) + `agent_skill_attachment` join table (`agent_id, skill_id, meta_skill_id, deployed_at`) — migration `V20__create_skill_library.sql`. New `domain/skill` package: `SkillLibraryService`, `SkillLibraryController` (`/api/v1/skills` CRUD, `/api/v1/agents/{id}/skills-view`, `/api/v1/agents/{id}/skills/{id}/promote`, `/api/v1/agents/{id}/skills/sync`).
- **The key behavior (founder's own design, replaces TASK-046's blocked live-fan-out model):** editing a Library `skill` row never touches Meta. Every agent attached to it shows the item as **"Out of sync"** (deliberately NOT called "Draft" — PM flagged that word is already `Agent.Status.draft` and would be confused with a different, unrelated severity) until the operator explicitly runs a NEW "Sync skills" action on that specific agent. Sync only pushes items that are actually stale (compares `skill.updated_at` vs `attachment.deployed_at`), and is NOT wrapped in one `@Transactional` — each item's Meta call + DB commit is independent, so one item failing mid-sync never rolls back items that already succeeded (`SkillLibraryService.syncSkills`/`syncOne`).
- **Important correction found during EM's review, worth remembering:** Skills were NOT a Meta-only thin proxy before this (only Connectors/Tools are). `AgentSkill` already had a real DB row that wrote through to Meta immediately on every save (`AgentService.addSkill/updateSkill/deleteSkill`). This change is a deliberate **inversion** of that already-working live-write behavior for any skill that gets promoted — not an additive change. Un-promoted (legacy `AgentSkill`) rows are completely untouched and keep writing through to Meta immediately, exactly as before.
- **Promotion (founder decision 2026-07-29): immediate, not deferred.** The moment an existing agent-scoped skill is "Promoted," it becomes fully Library-managed going forward — future edits go through the new deferred/sync model immediately, not on some later re-attach step.
- **A real, separate limitation discovered while building `AgentDeployService`:** the existing `deploy()` action only works for an agent's first activation — it throws `"Agent is already active"` if called again. So "open the agent and redeploy" for an already-live agent (like MDH Assistant) could NOT reuse the existing Deploy button — it needed the new, separate "Sync skills" action built in this task. Worth remembering for FAQs/Connectors slices too — they'll need the same kind of separate sync action, not a reuse of `deploy()`.
- **Deferred to later slices (each needs its own fresh PM+EM+EL gate):** FAQs, Connectors, a standalone Library page (browse/search across all Skills independent of any one agent), wizard inline-create-and-attach, Dashboard attention-triage integration ("N agents have out-of-sync skills").
- **TASK-043** (server-side title-pattern validation gap) stays open and independent — not absorbed by this change.
- **Bug found + fixed during live verification, EL gates didn't catch it:** `V20`'s `agent_skill_attachment.meta_skill_id VARCHAR(64)` reintroduced the exact bug `V14__widen_meta_external_id_columns.sql` already fixed for `agent_faq`/`agent_skill`/`agent_file`/`agent_website` — Meta's opaque platform IDs (`pfbid...`) exceed 64 chars, causing a live `MysqlDataTruncation` 500 on the very first real `promote()` call against MDH Assistant. Fixed via `V21__widen_agent_skill_attachment_meta_id.sql` (widened to `VARCHAR(255)`, matching V14's precedent). Full loop then verified live: promote → edit Library row → confirmed `OUT_OF_SYNC` → sync → real Meta PUT succeeded → confirmed `LIVE` with new content. **Lesson: check prior migrations for the same class of column before writing a new one with an external-ID field — don't just default to a round number.**

### TASK-051 — Standalone Skill Library page (deferred slice from TASK-050, pulled forward same day)
- **Status:** `[x] DONE — 2026-07-29` (PM+EM APPROVED; EL review pending)
- **What shipped:** `frontend/src/pages/SkillLibraryPage.tsx` — lists every Skill for the account's first accessible WABA (reuses existing `GET /waba` + `GET /api/v1/skills?wabaId=`), Create/Edit/Delete wired to the already-EL-approved `SkillEditorModal` Library-mode branch. New route `/library/skills`. `AppShell.tsx`'s "Skills" sub-nav item now routes here directly (static `to`) instead of deep-linking into whichever agent was last viewed — "Knowledge Base"/"Connectors" sub-nav items are UNCHANGED, still agent-deep-link/picker-mode, since only Skills has a Library so far. This inconsistency is intentional and silent — no "coming soon" copy added, per PM's explicit call (don't imply a timeline that isn't decided).
- **Follow-up, explicitly deferred (EM):** multi-WABA switcher. This account has 5 WABAs; the page currently just shows the first one returned by `GET /waba`, with the WABA's name shown in the page header so it's not silently ambiguous. No switcher UI built yet — needed once an operator actually needs to manage Skills across more than one WABA from this page.
- **Precedent worth remembering (PM):** the pattern "sidebar sub-nav → account/WABA-scoped list page, not an agent-scoped deep-link" is now established for Skills. When Knowledge Base/Connectors eventually get their own Library slices, reuse this exact pattern rather than re-deriving it.

### TASK-053 — Skills page: true aggregate (legacy + Library), not Library-only
- **Status:** `[x] DONE — 2026-07-29` (PM+EM APPROVED; EL review pending)
- **Bug the founder caught live:** TASK-052's Skills page only showed Library skills — tested against MDH Assistant (24 real skills: 23 legacy `AgentSkill` + 1 promoted), the page showed 1. The founder's original ask ("list of skills which all agents are currently having") meant a TRUE aggregate across every agent on the WABA, not Library-only — TASK-052 silently under-delivered the original scope.
- **Fix:** `SkillLibraryService.listSkills` now merges Library skills with every legacy `AgentSkill` row across every agent on the WABA. Two new batched queries (EM's explicit non-negotiable condition, same class of mistake already caught once this session): `AgentRepository.findAllByWabaId` (internal-use-only, comment warns it does NOT check `waba_account_access` itself — callable only after `requireWabaAccess` already ran, which `listSkills` does) and `AgentSkillRepository.findAllByAgentIdIn` (one query for all agents' legacy skills, not a per-agent loop).
- **Legacy skills are NOT deduplicated across agents** (two agents can each have their own independently-authored "identity" skill) — each carries `source="AGENT"`, `agentId`, `agentName` so duplicates are never confusing; they're always `deployed=true` (write-through to Meta immediately, per TASK-050). Library skills keep `source="LIBRARY"`, can be either Deployed or Draft.
- **PM required per-agent grouping, not deferred:** a WABA with several agents × a dozen-plus legacy skills each would be 50-90 rows in one flat list — PM explicitly rejected shipping that. Legacy skills now render grouped under a collapsed-by-default "`{agentName}` (N skills) ▸" section within Deployed; Library skills stay ungrouped (one canonical row each, no duplication problem).
- **Edit/delete correctly branch by `source`** (EM's explicit condition, same failure class as two prior REJECTs in this feature area): a `LIBRARY` row still edits via `PUT /skills/{id}` / deletes via `DELETE /skills/{id}` (unchanged); an `AGENT` row edits/deletes via the legacy `/agents/{agentId}/skills/{id}` endpoints, using the real `agentId` now carried on each row.
- **`SkillEditorModal`'s invalidation widened**: previously only Library-mode saves invalidated `['library-skills']`; now ANY save (legacy or Library) does, since this aggregate page can show either kind — harmless no-op everywhere else it's used (`SkillsTab.tsx`).

---

### TASK-052 — Skills Deployed/Drafts split + Skill Library reference catalog
- **Status:** `[x] DONE — 2026-07-29` (PM+EM APPROVED; EL review pending)
- **Naming correction:** what TASK-051 built and called "Skill Library" (`/library/skills` — skills shared across one WABA's own agents) is renamed to just **"Skills"** in the page title/copy (route unchanged). The founder's real "Skill Library" is the new, separate thing below — don't conflate the two.
- **Part 1 — Deployed/Drafts split:** `SkillLibraryService.listSkills` now computes `deployed: boolean` per skill via a single batched query (`AgentSkillAttachmentRepository.findDeployedSkillIds`, not a per-skill loop — EM's explicit condition) — `deployed = true` iff at least one `agent_skill_attachment` row has `deployed_at IS NOT NULL`, i.e. live somewhere, EVEN IF a newer edit is currently pending on some attachment (founder's explicit choice: a skill actually running in production must never look undeployed just because an edit is mid-flight). The existing per-attachment "Out of sync" badge (`SkillsTab.tsx`, TASK-050) is unchanged — that stays the finer-grained, per-agent signal; this is a coarser, per-skill bucket. `SkillLibraryPage.tsx` now renders two sections ("Deployed"/"Drafts") instead of one flat list.
- **Part 2 — new Skill Library reference catalog:** new `skill_template` table (`V22__create_skill_template.sql`) — GLOBAL, no `waba_id`/`account_id` at all, every logged-in account sees every template unconditionally (intentional, not an oversight — pure reference content, no tenant data). Seeded with 10 genericized starter templates (brand-stripped from this session's real MDH Spices skills — identity/order-support/handoff-guardrails/etc. — tagged by `industry`/`use_case`). New page `SkillTemplateBrowsePage.tsx` (`/library/skills/browse`, reached via a "Browse Skill Library" button on the Skills page) — filterable by industry/use-case, each template has a "Copy to my Skills" action.
- **Copy mechanic:** one-way `INSERT` (`SkillLibraryService.copyTemplate`) — no FK/link stored back to the template. Editing or deprecating a template later never affects anything already copied. Copied skill starts as a Draft (zero attachments), same as any newly created skill. EM confirmed this is the right default for v1 — trackable/updatable-later divergence tracking is a legitimate P2, correctly deferred (would be a strictly additive `source_template_id` column later, not a redesign).
- **No admin UI for templates yet** (founder's explicit choice) — new templates require a new Flyway migration for now.

---

### TASK-054 — Backfill imported agents' real Meta skills into local mirror
- **Status:** `[x] DONE — 2026-07-30` (PM+EM BLOCKED once on a real architecture question, resolved same session, then APPROVED; EL review pending)
- **Bug the founder caught live:** an "Imported agent" (auto-discovered via reconciliation, not built through our wizard) has a real, content-bearing skill live on Meta right now (confirmed via a direct live `GET agent_config/skills` call) — but zero rows in our local `agent_skill` table, so it never showed on any Skills view. Root cause: our Skills feature reads only from a local DB mirror, never live from Meta; reconciliation imports an agent's *existence* when discovered on Meta, but never backfills its existing skills content.
- **Blocking question, resolved:** PM/EM flagged that "reactive backfill" (only on view) vs "proactive backfill" (at reconciliation time) depends on whether any list/summary surface shows skill counts today — if one does and would under-report until an agent is opened, reactive isn't good enough. Checked: `AgentsPage.tsx` and the Dashboard show no skill count at all; the one place that does (`ConnectPhoneModal`'s pre-connect warning, `WabaService.deployPreflight`) already fetches it LIVE from Meta, unaffected by this bug. Founder confirmed: reactive is fine.
- **Fix:** `AgentService.ensureSkillsBackfilled(Agent)` (private) — no-op if local `agent_skill` rows already exist for this agent; else, if the agent has a real `phoneNumberId`, fetches `GET agent_config/skills` live (confirmed via `docs/meta-api/skills.md`: list endpoint returns a bare array — `List.class`, NOT `Map.class`, same class of mistake as `V20` earlier this session) and mirrors each returned skill into a new local `AgentSkill` row. Wrapped in try/catch/log.warn, same "never fail the primary read" pattern as `WabaAgentReconciliationService` — a Meta failure during backfill just means the agent still shows 0 skills that request, not an error page.
- **Wired into `AgentService.getSkills(agentId)`** (called by `SkillLibraryService.getAgentSkillsView`, i.e. the single-agent Skills tab) — NOT into `SkillLibraryService.listSkills` (the TASK-053 aggregate page), which stays batched-only per that method's own same-day EM gate. Explicit, accepted tradeoff: the aggregate Skills page will still show 0 for an agent nobody has opened yet, until they open its own Skills tab once.
- **Scope boundary, explicit:** this is GET-then-local-INSERT only — never writes anything back to Meta. Pure read-side mirror repair.
- **Follow-up flagged by EL, not blocking (accepted for a low-traffic internal tool):** two concurrent first-reads of a never-backfilled agent can both pass the "local rows empty" check before either inserts, producing duplicate `AgentSkill` rows — no unique constraint on `(agent_id, meta_skill_id)` prevents it. Acceptable today; add that constraint (or a lock) if this ever becomes a real occurrence, not preemptively.

---

### TASK-055 — Phone numbers sync automatically at login (slice 1 of "sync everything at login")
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED after a scope-reorder gate; EL review pending)
- **Founder's ask:** all Meta syncing (Skills, FAQs, phone numbers, agents) should happen automatically at login, not scattered reactive triggers per feature/page. Correctly scoped down (per PM+EM, two gates) to ONE domain per slice — this task is phone numbers only, the founder's own explicit pick (overriding an initial EM recommendation of FAQs), reasoned because phone numbers are foundational (everything else scopes under them) and today's phone-number behavior is the worst of any candidate: a live Meta call, with ZERO caching, on every single Dashboard page load.
- **Correction made mid-gate:** the first PM+EM review claimed no `@Async` infrastructure exists in this codebase — false, caught by re-checking the actual code: `@EnableAsync` is already on `PlatformApplication`, and `@Async` is already used in `WebsiteCrawlService`/`EvalRollupWorker`/`ApiCallLogWriter` (with an established "separate class so Spring's proxy applies" pattern, documented in their own comments). This is reusing an established pattern, not introducing async infrastructure for the first time — lower risk than the gate initially assessed.
- **What shipped:** `phone_number_snapshot` table (`V23__create_phone_number_snapshot.sql`) — scoped per `(account_id, phone_number_id)`, NOT per WABA, because agent visibility on a phone number is account-specific (`PhoneNumberAccessGuard`), confirmed live 2026-07-28/29. New `PhoneNumberSyncService.syncForAccount(accountId)` (`@Async`, own class per the established pattern) — calls the existing `WabaService.listAllPhonesForAccountId` (explicit-accountId variant, since an `@Async` method runs on a thread with no request-scoped `SecurityContext`), replaces the account's snapshot rows in one transaction. Wired into `SecurityService.login()` — fire-and-forget, never blocks the login response, never throws (best-effort, logs and gives up on failure — same pattern as `WabaAgentReconciliationService`).
- **The existing live-call path is NOT removed** — `WabaService.getCachedOrLivePhonesForAccount()` (new) reads the cache first, falls back to the original live `listAllPhonesForAccountId` path only if the cache is empty (e.g. a brand-new account before its first login-sync completes). Same "keep the reactive path as fallback" instruction as TASK-054.
- **Staleness made visible (PM's non-negotiable condition, carried over from the earlier FAQ-slice gate):** Dashboard now shows "Synced Xm ago" next to the phone numbers section, reading the real cache timestamp — not silently serving a cache with no indication of its age.
- **Explicitly deferred to future slices, each with its own gate:** Skills-at-login and FAQs-at-login (FAQs still has zero mechanism at all — real gap, not yet closed), eligibility/quality_rating/payment_status enrichment fields (not in the current fetch path at all — would conflate "cache what we fetch today" with "fetch new fields never fetched before").

---

### TASK-056 — Phone-number sync also fires when a WABA is connected, not just at login
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED; concurrency race fix verified live under genuine concurrent load after 4 iterations — see below)
- **Founder's ask:** connecting a new WABA (`WabaService.create()`) should also trigger the same phone-number sync built in TASK-055, not just login — otherwise a newly-connected WABA's phone numbers are invisible on the Dashboard until the next login (confirmed as a real, undesigned gap — `create()` never touched the sync at all before this task).
- **Bug caught by an actual runtime failure, not by review:** the first attempt injected `PhoneNumberSyncService` directly into `WabaService` (marked `@Lazy` to try to break the circular dependency). Compiled clean but **failed at application startup** with `BeanCurrentlyInCreationException` — `@Lazy` on a Lombok `@RequiredArgsConstructor`-generated field does not propagate to the actual constructor parameter. **Fix:** moved the trigger to the CONTROLLER layer instead (`WabaController.create()`), which can depend on both services with no cycle. Also the objectively correct placement on transaction-visibility grounds: `WabaService.create()` is `@Transactional`, so by the time the controller fires the sync, the `waba_account_access` grant is already committed.
- **Concurrency race — four fix attempts, only the fourth held up under real concurrent load:**
  1. Per-accountId `synchronized` lock (mirroring `AgentDeployService`) — did NOT work. The lock is inside the method body, but `@Transactional` wraps around the whole call, so the JVM monitor releases before the transaction actually commits. A lock can't serialize against a DB transaction boundary it lives inside of.
  2. Per-phone find-or-create-then-`saveAndFlush`, with try/catch(`DataIntegrityViolationException`) retrying as an update — did NOT work. Once `saveAndFlush()` throws, the Hibernate persistence context for that transaction is unusable (JPA spec: a `PersistenceException` invalidates the EntityManager) — the retry ran against the same broken session and re-threw the identical error. Confirmed live: the duplicate-entry error appeared twice per failing call.
  3. Single atomic native `INSERT ... ON DUPLICATE KEY UPDATE` per phone (`PhoneNumberSnapshotRepository.upsert`) — fixed the duplicate-key crash, but concurrent load testing (6 genuinely parallel login+connect calls via Python threads against freshly-cleared rows) surfaced a legitimate, different MySQL failure: `Deadlock found when trying to get lock; try restarting transaction` — a well-documented InnoDB gap-lock phenomenon for concurrent inserts into a unique secondary index, not a logic bug.
  4. **Final fix:** bounded retry (3 attempts) on `ConcurrencyFailureException` (Spring's translation of the deadlock), each attempt running in a genuinely fresh `REQUIRES_NEW` transaction via a manually-driven `TransactionTemplate` — a `@Transactional` method retried by looping inside itself would reuse the same doomed transaction, so the retry loop had to move outside the transactional boundary. **Verified live:** 8 genuinely concurrent login+connect requests against freshly-cleared rows — deadlock fired on 7 of 8 threads, all 7 retried successfully, zero `Phone sync failed` errors, final row count correct (7, no dupes, no loss).
- **Lesson:** adding a second trigger point for an existing async method needs its own concurrency review under REAL parallel load (Python `threading`, not sequential calls) — three plausible-looking fixes in a row were each wrong in a different way that only concurrent testing surfaced, not code review alone.
- **4th EL review — REJECT, caught cold on the fix #4 file (not by any live test run so far):** the stale-row cleanup deleted every existing row not present in that call's live result — correct for a fully successful fetch, but silently wrong whenever `live` was a PARTIAL result (one WABA's Meta call failed this round, per `unavailableWabaLabels`). A transient one-WABA blip permanently wiped that WABA's cached rows instead of preserving last-known-good data, contradicting the class's own documented contract — and this doesn't even need concurrency to reproduce, a single partial-fetch sync call triggers it. **Fix (5th and final iteration):** skip the stale-row cleanup pass entirely whenever the fetch was partial — a genuinely-removed number just waits for the next fully-successful sync to be pruned (never delete on incomplete information). **Verified live:** seeded a dummy snapshot row, triggered a sync during Meta's active rate-limiting (guaranteed partial/total failure — all 4 WABAs returned `Meta API error: 400`), confirmed the log line `partial — unavailable WABAs: [...]; skipping stale-row cleanup this round` and the dummy row survived (row count correct, no wipe) while the WABAs that did succeed still upserted normally.
- **Known tech debt (unchanged from TASK-055, now also applies here):** `syncForAccount()` re-syncs every WABA on the account, not just the newly-connected one — accepted given accounts today hold few WABAs.

### TASK-048 — Dashboard phone inventory doesn't distinguish "deleted" agent status
- **Status:** `[ ] OPEN` (flagged by EL 2026-07-29, pre-existing gap, fails safe — not a regression from the Dashboard summary feature)
- **Item:** `Agent.Status` has 4 values (`draft, active, paused, deleted`), but the new Dashboard phone-numbers table's `agentStatus` type (`DashboardPage.tsx`) and `PHONE_STATUS_CONFIG` only cover 3 (`draft, active, paused`). `WabaService.listAllPhonesForAccount()` (and the pre-existing `fetchPhonesFromMeta` it reuses) doesn't filter `agentRepository.findByPhoneNumberId` by status — if a phone is bound to a soft-deleted agent, the row silently falls back to "No agent deployed" instead of something clearer like "Deleted agent still bound to this number." Not a crash, not new to this change, but worth a real answer once soft-delete is exercised more.

---

### TASK-049 — Legacy duplicate `waba` rows caused wrong "No agent deployed" status
- **Status:** `[x] DONE — 2026-07-29` (PM+EM APPROVED with one added requirement; migration written, EL review pending before backend restart applies it)
- **Bug:** Real Meta WABA `494227720434920` had 7 duplicate rows in the `waba` table — one per account that ever registered it between 2026-07-23 and 2026-07-28, each with its own isolated `waba_account_access` grant. MDH Assistant (`agent.waba_id = 867344591100000001`) is a real, live, active agent — but an account with legitimate access to a *different* row for the same real WABA (`869472559203090432`, "FlexFit Studio") saw "No agent deployed" on every one of the WABA's 7 phone numbers, including the one MDH Assistant is actually deployed on. Root cause: `PhoneNumberAccessGuard.hasAccess()` checks `agent.getWabaId()` against `waba_account_access` for one exact row id — an account's grant to a *different* row for the same real WABA correctly (by current per-row logic) returns no access, even though it's the same real number. Confirmed live via DB query + screenshot evidence 2026-07-29.
- **Root cause confirmed via code, not guessed:** `WabaService.create()` is the ONLY place a `Waba` row is ever created (confirmed via `grep -rn "wabaRepository.save|new Waba(|Waba.builder"` — one file, one call site), and it already dedupes correctly and globally (`findFirstByWabaIdOrderByIdAsc`, not account-scoped) since the 2026-07-28 decoupling fix. These 7 duplicates are 100% pre-existing legacy data — today's code does not produce new duplicates going forward.
- **Fix:** `backend/src/main/resources/db/migration/V19__dedupe_waba_rows.sql` — general (not hardcoded to this one group) Flyway migration: groups `waba` rows by real `waba_id`, picks the canonical row (lowest `id`, mirrors `findFirstByWabaIdOrderByIdAsc`), repoints `waba_account_access` → `agent` → `client` (in that order — `client.waba_id` has a real `RESTRICT` FK per `V11`, found by EM's schema read, missing from the original proposal) → then deletes the orphaned duplicates. All statements `WHERE`-scoped to non-canonical duplicates, so a re-run after partial failure is a no-op.
- **Dry-run verified before writing the migration:** one duplicate group (`494227720434920`), 6 `waba_account_access` rows + 1 `agent` row affected, 0 `client` rows affected (none currently point at a duplicate).
- Applies automatically on next backend restart (Flyway). EL review of the exact SQL is the next gate before that restart.

---

### TASK-057 — WABA onboarding sync, remaining slices (design approved 2026-07-30, not built)
- **Status:** `[ ] OPEN` (PM+EM APPROVED the overall design/sequencing; TASK-056 above is slice 1, already shipped)
- **Founder's ask:** when a WABA is connected, sync everything — not just phone numbers (TASK-056), but eligibility, which agents are deployed and their names, FAQs, Skills, Connectors, Evals.
- **Real distinction surfaced by PM, must not be silently absorbed:** phone numbers and eligibility are genuinely WABA-scoped (one WABA, one set of data) — but FAQs/Skills/Connectors/Evals are AGENT-scoped (a WABA can have N agents, each with its own). "Sync the WABA's FAQs" isn't a coherent single action the way "sync the WABA's phone numbers" is — it requires a two-step operation: first discover which agents exist on this WABA (slice 2, below), then fan out sync per discovered agent. Do not build slices 4-6 as a flat "sync at connect" trigger without slice 2 existing first.
- **Corrections found by EM while scoping this (verify current, don't re-assume from an old summary):** eligibility is NOT unwired — `AgentService.bindPhone()` already calls `GET agent_eligibility` and gates on it; this is a second-call-site addition, not a from-scratch integration. FAQs and Connectors are confirmed genuinely empty service packages (`domain/faq/service/`, `domain/connector/service/`) — zero sync mechanism exists for either. Evals has no dedicated domain at all (`EvalRollupService`/`Worker` live under `domain/reports`, a different concept) — needs its own design conversation before it's a codeable slice, not just an EL review.
- **Recommended slice order (each its own PM+EM+EL gate, not batched):**
  1. ~~Phone numbers~~ — DONE, TASK-056.
  2. **Agent discovery/name sync** via `WabaAgentReconciliationService` at connect-time (currently only fires synchronously from `getPhones()`, view-time only) — lowest additional risk (reuses an existing, working service, same "add a call site" shape as TASK-056), and it's the prerequisite fan-out point every later agent-scoped slice depends on.
  3. **Eligibility** (per phone number) at connect-time — Meta endpoint already proven in `AgentService.bindPhone`, but needs its own sync-loop wiring and its own error handling (a failed eligibility check today just blocks a bind; inside a background sync loop it needs different handling, not shared with phone-snapshot writes) — keep separate from `PhoneNumberSyncService`, don't fold in.
  4. **Skills — eager sync** at connect-time, fanning out over agents discovered in slice 2. `SkillLibraryService`'s backfill (TASK-054) and `syncSkills()` push already exist — this slice just triggers them eagerly instead of waiting for someone to open the Skills tab.
  5. **FAQs** — genuinely net-new sync mechanism (fan out over agents from slice 2). Needs real design (what does a local FAQ mirror table look like, matching the `agent_skill`/Skill Library pattern already established) before it's codeable.
  6. **Connectors** — same net-new-build risk profile as FAQs, sequenced after (lower assumed usage today — confirm with founder before locking this order in).
  7. **Evals** — no dedicated domain exists; sequence last and treat as "needs a design pass," not a normal implementation slice.

---

### TASK-062 — Files/Websites GET+reconcile, plus discovered-and-fixed unwired UI (2nd item of the Meta-sync backlog)
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED as part of TASK-061's gate; EL REJECTed once on 2 real bugs, both fixed, re-reviewed APPROVE; verified live including a real drift-detection repro)
- **Backend, mirrors TASK-059's FAQ reconciliation shape exactly:** `AgentFile`/`AgentWebsite` gained `metaSynced` (no `metaSyncAttempted` needed here, unlike FAQ — confirmed `addFile`/`addWebsite` already throw hard on a failed Meta write with zero local-only fallback path, so every local row implies its Meta create already succeeded; the only drift this can catch is content changed/removed directly on Meta afterward). `Agent` gained `fileReconciledAt`/`websiteReconciledAt` TTL gates (10 min, shared constant renamed `META_RECONCILE_TTL_MINUTES` since it's now used by 3 domains). `reconcileFiles`/`reconcileWebsites` wired into `getFiles()`/`getWebsites()`, reactive, single-agent-read-triggered only, best-effort, never throws.
- **Scope discovered mid-task, not caused by this task:** `WebsitesSection`/`FilesSection` in `AgentDetailPage.tsx` were entirely unwired placeholders — hardcoded `0` count, `// TASK-036: wire POST /agents/:id/websites`/`/files` comments, `onChange` handlers that did nothing. Founder explicitly chose to wire the full CRUD UI now (list/add/upload/delete) rather than defer it, since the reconciliation backend just built would otherwise have no UI to attach a "Not synced" badge to.
- **EL REJECT — two real bugs, caught cold on review, not live-tested first:**
  1. The file-upload mutation set `headers: { 'Content-Type': 'multipart/form-data' }` explicitly — this strips the `boundary=` parameter the browser/axios would otherwise attach automatically, so every upload would 400 server-side. Compounding factor: the shared `api` axios instance (`lib/api.ts`) defaults `Content-Type: application/json`, so simply omitting the header override wasn't sufficient either — the fix needed `headers: { 'Content-Type': undefined }` to explicitly unset the instance-level default and let axios's FormData auto-detection take over.
  2. The Upload `<label>`/`<input>` was nested inside the section's toggle `<button>` with no `stopPropagation` — clicking Upload also collapsed the section via event bubbling. Fixed by adding `stopPropagation` on both the label and the input (mirroring the FAQ section's existing "Add FAQ" inner-button pattern, which already handled this correctly).
- **Non-blocking EL note, fixed anyway:** the new `NotSyncedBadge` component duplicated the FAQ section's existing inline "Not synced" badge markup instead of replacing it — refactored FAQ's badge to use the shared component (gained an optional `title` override so FAQ's more specific tooltip text was preserved, not genericized).
- **Verified live, including a real drift-detection repro** (not just "it compiles and returns 200"): added a website through the real API, confirmed `metaSynced: true`; directly corrupted one local row's `metaWebsiteId` to a value that doesn't exist on Meta and cleared the TTL, called `getWebsites()` again, confirmed reconciliation correctly flipped that row to `metaSynced: false` while leaving the genuinely-live row `true`. Also verified real multipart file upload end-to-end (upload → 200 with `metaSynced: true` → delete → 200), and cleaned up all test data afterward.
- **Incidental finding during testing, not a bug in this task:** phone number `1550000250a22` (a synthetic/malformed test number in this account, not a real Meta-format ID) returns a genuine `500` from Meta on both FAQ GET (TASK-059) and Website POST — consistent, reproducible, unrelated to today's code. Retested against the real MDH test number (`1103393549522539`) and everything worked correctly. Not investigated further — it's bad test data, not a platform bug.
- **Deferred, per PM+EM's resolved order:** Connectors and Allowlist remain explicitly not started (see TASK-061).

---

### TASK-061 — Phone number health/quality fields (P0, first of a 4-item Meta-sync backlog)
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED, ranked #1 of 4 by real operator stakes; EL APPROVED with one non-blocking comment-accuracy fix)
- **Founder's ask:** after WABA phone-number sync (TASK-056), "make all possible GET calls to Meta" per agent/phone number and save results locally — flagged specifically: agent connectors, phone number health. PM+EM gate decomposed this into 4 separate bets rather than one: **Phone health (this task)** and **Files/Websites reconciliation** APPROVED; **Connectors storage** and **Allowlist** BLOCKED (Connectors reopens the account-vs-agent-scope architecture question from TASK-060, needs its own gate; Allowlist has zero consumer anywhere in the codebase — before spending an engineering minute there, confirm a feature actually needs it).
- **The gap, confirmed via direct code read (not guessed):** `fetchPhonesFromMeta`'s `GET /{wabaId}/phone_numbers` call had no explicit `fields=` param, so Meta returned only its default set (`id`, `display_phone_number`, `verified_name`) — `quality_rating`, `name_status`, `messaging_limit_tier` were never requested at all. `quality_rating` is the leading indicator before WhatsApp restricts/bans a number — the founder correctly flagged this as the highest-stakes gap in the whole list.
- **Built:** explicit `fields=id,display_phone_number,verified_name,quality_rating,name_status,messaging_limit_tier` on the existing Graph API call (one-line change, no new Meta call). 3 new fields threaded through `WabaDtos.PhoneNumber`/`AccountPhoneNumber`, `PhoneNumberSnapshot` entity (+migration V26), the native upsert query (`PhoneNumberSnapshotRepository`), and `PhoneNumberSyncService`'s write path — reuses TASK-056's existing sync/cache infrastructure entirely, no new sync loop needed. Dashboard's `PhoneNumbersTable` gained a `QualityBadge` (GREEN/YELLOW/RED, falls through to a neutral badge for any other value rather than hiding the signal).
- **EL review:** APPROVE, with one non-blocking finding — the code comments for `extractQualityRating`'s dual-shape parsing (flat `quality_rating` string vs. nested `quality_score.score`) and the frontend's GREEN/YELLOW/RED enum both cited "Meta's docs" for shapes/values that aren't actually documented anywhere in `docs/meta-api/`. Fixed immediately: comments now say "shape/values unconfirmed, defensive fallback" instead of citing a source that doesn't exist. The defensive code itself was correct either way (fails to `""`, never throws) — this was a comment-accuracy fix, not a logic fix.
- **Verified live against real Meta data** (not just compiled): `GET /waba/{wabaId}/phones` returns real `qualityRating: "GREEN"`, `nameStatus: "APPROVED"` for every currently-connected test number; the cached Dashboard summary path returns the same fields correctly after a re-sync. `messagingLimitTier` came back empty for all current test numbers — plausible (that field is typically only populated once volume tiers actually apply), not investigated further since nothing here is broken by it.
- **Deferred, per PM+EM's resolved order:** Files/Websites GET+reconcile (next — same `reconcileFaqs`/`ensureSkillsBackfilled` reactive pattern, entities already exist). Connectors and Allowlist explicitly not started.

---

### TASK-060 — Business Persona: card view → account-wide search/filter/table
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED with scope cut; EL REJECTed once on component size, fixed, re-reviewed APPROVED)
- **Founder's ask:** apply a uniform search+filter+table layout (Name/Status/Deployed-on-agent-and-number/Last-edited) across Skills, Connectors, and Business Persona. PM+EM gate found this couldn't be applied uniformly — three genuinely different data shapes (Skills: multi-attach; Persona: 1:1-per-number; Connectors: zero local storage) needed three different verdicts, not one blanket yes. This task is Persona only.
- **Scope cut, confirmed against the real data model:** dropped the "Agent" column — `BusinessProfile.phoneNumberId` is a single field, not a collection, so a profile is never attached to an agent the way a Skill is; the column would always show exactly one meaningless value. Kept Name/Status/Phone number/Last touched.
- **Built:** `usePersonaData()` hook — account-wide drafts (`GET /business-profiles/drafts`) fanned out with per-phone-number live+history (`GET /business-profiles/live|history?phoneNumberId=`), client-side aggregated into one row-per-profile list. Accepted as a small, bounded fan-out (few phone numbers per account, same assumption already used for the Dashboard's phone inventory) — not the unbounded "loop over every agent" shape EM explicitly ruled out for Connectors. `PersonaTable`/`PersonaFilters` components render search (by description) + status filter + the table; per-row "Deploy to..." dropdown, keyed by draft id (`Record<string,string>`), not a single shared variable.
- **Backend change, additive only:** `BusinessProfileDtos.BusinessProfileResponse` gained `updatedAt` (entity already had the column, just wasn't exposed) — needed for the "Last touched" column on drafts, which have no `deployedAt`/`archivedAt` yet.
- **EL REJECT #1:** page was 349 lines in one component, over this project's 200-line-without-justification rule. Fixed by extracting `usePersonaData.ts` (data-fetching hook), `PersonaTable.tsx` (table + a `PersonaTableRow` sub-component), `PersonaFilters.tsx` (search/status filter + the draft editor wrapper) — page itself dropped to 152 lines, all four files under 200. Re-review confirmed the split introduced no new bugs (per-row deploy-target wiring, hook/page prop boundary, and the a11y label fixes from the correctness pass all verified intact).
- **Real bug caught by live verification, not by any review round:** `GET /waba/{wabaId}/phones` expects the EXTERNAL Meta WABA id (`WabaService.getPhones`'s `findFirstByWabaIdOrderByIdAsc` lookup), not our internal DB row id — the first version called it with `waba.id` and got a `400 "WABA not found"` for every WABA in the account. Neither EL review round caught this (both reviewed query/race correctness and component structure, not endpoint-id semantics) — only hitting the real endpoint with real data surfaced it. Fixed: use `waba.wabaId`. Also cleaned up a `PhoneEntry` interface that declared `wabaId`/`wabaLabel` fields the actual `WabaDtos.PhoneNumber` response doesn't have (harmless — those fields were never read — but inaccurate).
- **Lesson, reinforcing TASK-059's:** EL review correctness passes and live-endpoint verification catch genuinely different bug classes — this task needed both, in that order, before it was actually done.
- **Deferred, explicitly out of scope per PM+EM:** Skills table (needs 2 additive migrations — `phoneNumberId`, `updatedAt` on `AgentSkillAttachment` — before the columns would be real, not fabricated) and Connectors table (blocked — zero local storage today, would reopen the account-wide-vs-agent-scoped architecture question; needs its own PM+EM gate and a real answer to "do operators need cross-agent connector comparison" before any backend work starts).

---

### TASK-059 — FAQ/Meta reconciliation (P0 correctness fix, sequenced before FAQ Library)
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED, split into P0 reconciliation + P1 Library, this is P0 only; EL REJECTed twice on real issues, both fixed, 3rd review APPROVED)
- **Founder's ask (via "should FAQs get Skills-style treatment too?"):** PM/EM found this wasn't one bet — Skills' Library bundles two separable things: reuse-across-agents (real, but P1) and "did this actually sync to Meta" trust (a real pre-existing gap, P0, independent of Library). This task is P0 only. P1 (account-wide FAQ Library, new `domain/faq` tables mirroring Skill/SkillTemplate/AgentSkillAttachment) is scoped but not built — separate task, own gate, when picked up.
- **The bug:** `addFaq`/`updateFaq`/`deleteFaq` push to Meta with a silent "local-only, log WARN" fallback on failure — nothing ever confirmed our DB and Meta's actual FAQ list still agreed. A silently-failed sync could sit undetected until the bot answered wrong on WhatsApp.
- **Built:** `AgentFaq.metaSynced` (false = last write failed or reconciliation found this row missing from Meta) and `AgentFaq.metaSyncAttempted` (false only for FAQs created while the agent had no phoneNumberId yet — nothing to attempt). `reconcileFaqs(agent)`, called reactively from `getFaqs()` (same trigger point as Skills' `ensureSkillsBackfilled` — single-agent read only, never an aggregate listing), pulls Meta's live FAQ list and flips `metaSynced` to match reality. Frontend shows a "Not synced" badge (`AgentDetailPage.tsx`).
- **EL REJECT #1, three real issues caught cold on review (not live-tested first):**
  1. Reconciliation ran on **every** `getFaqs()` call, no cache — reintroducing the "always live, never cached" anti-pattern this project has been actively moving away from. **Fixed:** `Agent.faqReconciledAt` TTL gate (10 min, migration V25) — only spends a Meta call if stale.
  2. A draft agent's FAQs (never pushed yet, sync happens at bind time) would get falsely flagged "Not synced" by the comparison — they were never supposed to be there yet, that's not the same as broken. **Fixed:** `metaSyncAttempted` flag, reconciliation skips any row where it's false.
  3. `deleteFaq`'s Meta-delete-failure path silently leaves zero local trace (worse than addFaq/updateFaq's failure case) — flagged as a real gap with no explicit decision recorded. **Fixed:** documented as a deliberately deferred follow-up in an explicit code comment (needs a "pending delete" tombstone concept to fix properly — real scope, not a one-line change, own future task).
- **EL re-review: APPROVED**, all 3 verified fixed, no new bugs (checked TTL-still-set-when-nothing-to-compare, transactional safety of the mid-method `agentRepository.save()`, `updateFaq` correctly flipping `metaSyncAttempted` on first real attempt).
- **Bug caught by live verification AFTER EL approval, not by any review round:** a missing `import java.time.LocalDateTime;` in `AgentService.java` compiled fine under `mvn -o compile` (stale incremental target/classes silently reused a prior successful compile) but crashed every real request with `java.lang.Error: Unresolved compilation problems` once `spring-boot:run`'s devtools recompiler actually touched the file. **Lesson: `mvn compile` succeeding is not proof of a clean compile if `target/classes` might be stale — a genuinely fresh compile (`rm -rf target/classes` first, since the offline `clean` plugin goal is itself broken in this environment) is what actually caught it.** Fixed by adding the import.
- **Second bug caught by live verification:** the new `reconcileFaqs` GET call used `MetaApiClient.scopedPath(path, agent.getMetaAgentId())` to append `?agent_id=`, copied from the Skills reconciliation pattern — but FAQ's own `addFaq`/`deleteFaq` calls never scope this way (only `updateFaq` does, a pre-existing inconsistency, not something to imitate for a new call). Removed the scoping to match the established convention for this resource.
- **Known limitation, shipped anyway per explicit founder decision:** even after both fixes above, Meta's `GET agent_config/faq` returns a genuine, consistent `500 Internal Server Error` for our test phone number (`api_call_log` confirms: same call pattern that returns 200 for `agent_config/skills` returns 500 every time for `agent_config/faq`, with query-param scoping ruled out as the cause). This could be a Meta-side bug specific to this test/sandbox number, or a real gap in what this endpoint supports despite `docs/meta-api/faq.md` documenting `GET /` as supported. The reconciliation mechanism itself is verified correct and fails safe (never crashes `getFaqs`, never corrupts `metaSynced` flags, `getFaqs` still returns 200 with correct data when the Meta call 500s) — founder explicitly chose to ship as-is rather than block on resolving Meta's side, flagging this open question for whenever a real (non-test) phone number is available to retest against.

---

### TASK-058 — Business Persona promoted to a 4th Agents sidebar entry (frontend only)
- **Status:** `[x] DONE — 2026-07-30` (PM+EM APPROVED; EL APPROVED — one non-blocking a11y nit found and fixed)
- **Founder's ask:** Business Persona (`domain/persona`/`BusinessProfile`) already shipped with the exact same DRAFT/DEPLOYED/ARCHIVED lifecycle as Skills, but the frontend only surfaced it as a tab buried inside a single agent's detail page (`BusinessProfileTab.tsx`) — never promoted to the sidebar's `AGENT_SUB_NAV` the way Skills/Knowledge Base/Connectors were. Founder flagged this as a real inconsistency.
- **PM+EM gate resolved the actual scope question, not just "add a label":** should the new sidebar entry deep-link into the existing per-agent tab (Knowledge Base/Connectors pattern), or route to a new standalone account-wide page (Skills Library pattern)? Resolved: **standalone page**, because Persona drafts are account-wide (not attached to any phone number until deployed) — the identical shape problem that justified Skills getting its own Library. A deep-link would just relocate the same scoping mismatch one level up the nav instead of fixing it.
- **Confirmed before building (not assumed):** `BusinessProfile.phoneNumberId` is a single nullable field, not a collection — strictly one profile deployed per phone number at a time, no multi-attach. Deliberately did NOT copy `SkillLibraryPage.tsx`'s agent-grouping UI (`agentGroups`), since Persona's data model doesn't have Skills' one-skill-on-many-agents relationship to group by.
- **Built:** new `frontend/src/pages/BusinessPersonaLibraryPage.tsx` — account-wide drafts list + a phone-number selector (reused `/waba` + `/waba/{id}/phones`, same resolution order as `SkillLibraryPage.tsx`) driving per-number live/history sections and deploy. `BusinessProfileTab.tsx` kept as-is on the agent-detail page (still correct for "what's live on this specific agent") — only change there was adding `export` to its already-existing form/helpers (`ProfileEditor`, `toFormValues`, `extractMessage`, `EMPTY_FORM`) so the new page could reuse them without duplicating the 8-field form. New route `/library/persona` in `App.tsx`; new 4th `AGENT_SUB_NAV` entry in `AppShell.tsx` (`{ tab: 'persona', label: 'Business Persona', staticTo: '/library/persona' }`).
- **No backend changes** — the `/business-profiles/*` API already fully supported this; this was purely a frontend nav/page gap.
- **EL review:** approved on first pass; confirmed no stale-closure/race risk in the deploy flow even though `phoneNumberId` now comes from a dropdown instead of a parent-passed prop (react-query re-binds the mutation's closure on every render). One non-blocking nit (phone-number `<select>` not linked to its `<label>` via `htmlFor`) — fixed immediately, not deferred.

*Worker writes → Engineering Lead reviews → approved → committed. No self-approval.*

---

### Follow-up (not yet built) — poll(jobId) has no tenant check
- **Flagged:** 2026-08-05, during EL review of the new `GET /eval-rollup/latest` endpoint (Phase 2 roadmap item 19).
- **Gap:** `EvalRollupService.poll(String jobId)` has no account-ownership check at all — any authenticated account that can guess/observe a rollup job UUID can read another account's eval results (agent names, scores). `getLatestCompleted()` (built same day) correctly scopes by `accountId`; `poll()` does not, and should before this surface is hardened further.
- **Fix shape:** verify `job.accountId.equals(currentAccountId)` inside `poll()`, 404/NotFoundException otherwise — same fail-closed pattern already used elsewhere in this codebase.
- **Status:** `[ ] NOT STARTED` — tracked here so it isn't silently dropped, not yet scheduled.
