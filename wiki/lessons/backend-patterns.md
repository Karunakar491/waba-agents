---
title: Backend Patterns & Traps
tags: [lessons, backend, java, spring, testing]
---

# Backend Patterns & Traps

---

## Lombok constructor conflict

Hit three times in one session (`KarixMessagingClient`, `NvidiaLlamaAdapter` twice) while copy-pasting a class skeleton carrying `@RequiredArgsConstructor` and then adding a manual constructor for custom setup — building a `RestClient` with timeouts from a `@Value` base URL, typically.

Lombok generates a second constructor. With two constructors and neither marked `@Autowired`, Spring can't choose and fails at context startup with `No default constructor found` — an error that doesn't point at the real cause.

**Rule:** whenever a class needs a manual constructor, remove `@RequiredArgsConstructor`.

## Move the test, don't widen the accessor

During the Iris package move, a test needed `AiCredentialService.resolveForConversation()` and `ResolvedAiCredential` — package-private, and returning a **decrypted API key**. First instinct was to make both public. EL rejected that twice: once for asserting the widening was justified without evidence, once for the justification being invented.

**Rule:** if a moved test loses package-private access, move the test into the class's package. Never widen a security-adjacent accessor to serve one caller. Grep every real call site first — if the only external consumer is the test itself, that's the answer.

## Scheduled jobs fire during the test suite

`@EnableScheduling` on `PlatformApplication` is unconditional and not test-profile-gated. A long combined suite (3+ Testcontainers classes) crosses a real wall-clock cron boundary, fires the real `GlobalSyncScheduler` job, which fans out across `metaSyncExecutor`'s 16 threads and starves the tiny test connection pool.

It manifested as a **multi-hour silent hang** (HikariCP `ConcurrentBag.borrow` parked forever), not a crash. ~2 hours to root-cause via thread dump.

**Rule:** `GlobalSyncScheduler` must stay `@MockBean`'d in integration tests. Nobody had run 3+ integration classes in one JVM before, which is why it lay hidden.

## Testcontainers `withReuse(true)` makes tests order-dependent

Tests that hardcode ids and rely on rows another class left behind pass alone and fail in a suite. `ConversationStoreTest` failed on `fk_conv_agent`, then `fk_agent_account`, because it assumed `accountId=1001` and `agentId=2001` existed.

**Rule:** seed your own fixtures per test. Clean up only your own rows — a blanket `deleteAll()` strips rows other classes depend on.

## Parallel agents cannot share one `target/` directory

Two agents running Maven in the same working tree corrupt each other's build output. Give each a worktree.

## Guard on the condition you actually mean

`AgentTeardownService` refused to delete any agent with a `phoneNumberId` unless it was paused — intending to protect live agents. But the create wizard binds the number on step 1, so an abandoned wizard leaves a **draft** with a number that has never answered anyone. Pause refuses drafts ("Agent is not currently active"), so such a draft could be neither paused nor deleted, and it held its phone number hostage forever.

The comment two lines above already warned that refusing there "would make draft agents permanently undeletable". The guard just tested the wrong thing.

**Rule:** when a comment names a failure mode, check that the condition below it actually excludes that case.

## Derive on read when the source is already stored

The webhook handoff signal is a pure function of the payload we already persist. Deriving it in the response DTO needed no migration **and** classified the rows already in the table — a stored column would only have described webhooks arriving after the deploy.

**Rule:** prefer deriving over storing when the input is already durable and the computation is cheap. Reach for a column when you need to filter or index in SQL.

## Logging conventions

JWT parse failures at `debug`. Webhook parse failures at `warn` with a payload preview.

## Credentials belong to `esme_addr`, not the WABA

An unordered `findFirstByWabaId` could pick the wrong credential and silently return an empty template list.

---

## Related

- [[architecture/INDEX|Architecture]]
- [[lessons/verification|Verification]]
- [[lessons/frontend-patterns|Frontend Patterns]]
