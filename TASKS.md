# TASKS.md — Meta Business Agent Platform
**Last Updated:** 2026-07-19  
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
| P0 | E2E Meta validation | Real WABA + token: deploy test agent, send WhatsApp msg, verify webhook lands in inbox. Never done — highest-risk unknown in the product. |
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

*Worker writes → Engineering Lead reviews → approved → committed. No self-approval.*
