# EL Deep Audit — Iris + Template Management

Date: 2026-08-07
Scope: `backend/.../domain/templatestudio/**` (incl. `iris/` subpackage), `TemplateStudioService`,
`TemplateStudioController`, `TemplateStudioClient` (karix-mcp proxy), all `AiProviderAdapter` implementations,
`SecretEncryptor`, `frontend/src/pages/TemplateIrisPage.tsx`, `useTemplateBuilder.ts`.
Read-only review — no code changed.

---

## HIGH

### H1. Iris's tool-execution path bypasses the same input validation the human UI enforces
`IrisConversationService.executeTool()` (backend/src/main/java/com/metaagent/platform/domain/templatestudio/iris/IrisConversationService.java:243-278) builds a raw `Map<String,Object>` from model-supplied tool arguments and calls `templateStudioService.createTemplate(wabaId, payload)` / `editTemplate(...)` directly.

Contrast with the human path: `TemplateStudioController.createTemplate()` (TemplateStudioController.java:26-29) takes `@Valid @RequestBody TemplateRequest`, which presumably enforces Bean Validation constraints (`@NotBlank`, category enum, etc. — see `TemplateRequest.java`/`EditTemplateRequest.java`). Iris's path never constructs a `TemplateRequest`/`EditTemplateRequest` and never triggers `@Valid` — it goes straight to `Map` → `templateStudioClient.createTemplate(...)`.

Only defense on the model-driven path is the system prompt's prose instruction ("category must be exactly MARKETING, UTILITY, or AUTHENTICATION") — which the codebase's own CLAUDE.md doctrine explicitly rejects as sufficient ("this enforcement lives in code, never trusted to system-prompt instruction alone" — this exact phrase is used one paragraph away, at IrisConversationService.java:24, for tool-name allowlisting, but the same discipline was not applied to payload shape/category/language validation).

**Recommendation:** Route Iris's `create_template`/`edit_template` tool arguments through the same `TemplateRequest`/`EditTemplateRequest` validation (construct the DTO and run it through the validator, or extract a shared validation method `TemplateStudioService` can call before touching karix-mcp) so a malformed or hallucinated field from the model gets the same 400-with-clear-message treatment a human typo would, rather than an opaque karix-mcp rejection or a template silently created with a bad category.

---

### H2. `AiCredentialService.upsert()` — non-atomic delete+save, no `@Transactional`
`AiCredentialService.java:38-61`. The method: (1) queries all credentials for the account, deletes every row not matching the new provider (line 48-50), then (2) finds-or-creates a row for the new provider and saves it (line 52-57). Multiple sequential writes, no `@Transactional` on the method or the class.

If the process crashes, the DB connection drops, or `repository.save()` at line 57 throws (caught only for `DataIntegrityViolationException`) *after* the old-provider row(s) were already deleted at line 50, the account is left with **zero** credentials — `AiCredentialService.resolveForConversation()` (line 64-70) then tells the user "Iris needs an AI provider key configured first," even though they just successfully saved one. This is a real user-facing regression path, not theoretical: switching provider is exactly the operation described in the class's own comment as needing to be atomic ("switching providers replaces the old one rather than leaving two rows").

**Recommendation:** Add `@Transactional` to `upsert()` (class already uses `@RequiredArgsConstructor`/`@Service`, trivial to add `org.springframework.transaction.annotation.Transactional`). This is the exact "@Transactional missing on multi-step write" trap called out in this project's own EL checklist.

---

## MEDIUM

### M1. Massive duplication across `OpenAiAdapter` and `NvidiaLlamaAdapter` — same code, no shared base
`OpenAiAdapter.java:61-129` and `NvidiaLlamaAdapter.java:67-141` are near line-for-line identical: same message-list construction (system + history), same tool-def mapping to `{type:"function", function:{...}}`, same response parsing (`choices[0].message`, `tool_calls[0].function.arguments` JSON-string parse, same fallback to `content` text, same three `BusinessException` messages differing only in provider name), same constructor pattern (RestClient.Builder + Duration timeouts + test-only raw-RestClient constructor).

This is the exact "duplicated 3+ times" trigger this project's EL persona is instructed to reject on sight — here it's 2 files at ~95% identical, and a 3rd (`ClaudeAdapter`) shares the outer try/catch/log/`BusinessException`-wrapping shape even though its wire format differs.

**Recommendation:** Extract a shared abstract base (e.g. `OpenAiCompatibleAdapter`) holding the message-building, tool-def mapping, and OpenAI-shaped response parsing, parameterized by base URL / provider name / timeout Duration. `OpenAiAdapter` and `NvidiaLlamaAdapter` become thin subclasses supplying only those four values. Not blocking today, but the moment a 3rd OpenAI-compatible provider is added (Groq, Together, etc. — plausible given the closed-set-but-growing `AiProvider` enum), this becomes a REJECT-on-sight per this project's own rules.

### M2. Hardcoded `Duration` timeouts scattered per-adapter, not configuration-driven
`ClaudeAdapter.java:33-34` (5s/30s), `OpenAiAdapter.java:43-44` (10s/60s), `NvidiaLlamaAdapter.java:44,49` (10s/60s), `KarixMessagingClient.java:62-63` (5s/15s), `TemplateStudioClient.java:47-48` (5s/15s). All are literal `Duration.ofSeconds(N)` in Java code, not `@Value`-injected from `application.yml` like the `baseUrl`s next to them in the same constructors.

This is inconsistent with the same classes' own pattern one line above: `baseUrl` is externalized via `@Value("${claude.api.base-url:...}")` but the timeout right next to it is not. Practical impact: NVIDIA's 60s read timeout (chosen per the comment at NvidiaLlamaAdapter.java:45-49 to match "Claude's own effective ceiling") can't be tuned per-environment (e.g. shortened in a staging smoke test, or raised again if a future provider is slower) without a code change + redeploy — direct tension with this project's own Kill Switch doctrine of config-driven, redeployable-in-minutes behavior.

**Recommendation:** Externalize each adapter's connect/read timeout the same way `base-url` already is: `@Value("${claude.api.connect-timeout-ms:5000}")` etc. Low effort, removes a recurring source of "why is this adapter using a different timeout than that one" review friction (already visible in the code comments themselves).

### M3. `requireOwnedSession()` issues two queries where one suffices
`IrisConversationService.java:308-314`:
```java
private IrisSession requireOwnedSession(Long sessionId) {
    Long accountId = SecurityContextHelper.getRequiredAccountId();
    if (!sessionRepository.existsByIdAndAccountId(sessionId, accountId)) {
        throw new NotFoundException("Session not found");
    }
    return sessionRepository.findById(sessionId).orElseThrow(() -> new NotFoundException("Session not found"));
}
```
Called on every `getMessages`, `sendMessage`, `confirmPendingAction`, `cancelPendingAction` — i.e. every Iris turn does 2 round-trips to fetch 1 row. `findById(sessionId)` alone does not re-check `accountId`, so the `exists` check is doing real tenant-isolation work, but it's redundant with a `findByIdAndAccountId(Long id, Long accountId)` query method that would do both in one query.

**Recommendation:** Add `Optional<IrisSession> findByIdAndAccountId(Long id, Long accountId)` to `IrisSessionRepository` and use it directly — same tenant-isolation guarantee, half the queries, on the hottest path in this module.

---

## LOW

### L1. `sendMessage()` performs multiple non-atomic saves across an external AI call, no `@Transactional`
`IrisConversationService.sendMessage()` (IrisConversationService.java:155-205): saves the user message (161), conditionally saves the session title (164-165), calls the external AI provider (180 — a network call with up to 60s timeout per M2), then depending on result saves an assistant/tool message and possibly mutates+saves session pending-tool state (198-202). None of this is wrapped in `@Transactional`. If the process dies after the AI call succeeds but before the final save, the user's message is persisted but Iris's reply/pending-tool-state is lost — next load shows a dangling user turn with no reply. Not corruption (no partial multi-row invariant is broken the way M2's provider-switch is), but worth a `@Transactional` sweep of this class alongside the H2/M3 fixes rather than three separate patches.

### L2. `AiProviderCredential.id` lacks `@JsonSerialize(using = ToStringSerializer.class)`
`AiProviderCredential.java:25-28` — contrast with `IrisSession.id` (IrisSession.java:28-32) and `IrisMessage.id`, which both correctly annotate the TSID `Long id` field to avoid JS `Number.MAX_SAFE_INTEGER` truncation, per this project's own documented convention (comment at IrisSession.java:31). Today `AiProviderCredential` is never returned to the frontend directly (`AiCredentialService.CredentialStatus`/`listOptions()` return hand-built records, not the entity), so this is currently inert — but it's one accidental `@RequestMapping` change away from silently truncating a credential ID in the browser. Add the annotation now for consistency; costs nothing, closes the latent gap.

### L3. `TemplateStudioClient` mints a fresh karix-mcp JWT on every single call, including read-only `listTemplates`/`getTemplate`
`TemplateStudioClient.java:52-78`, called at the top of every one of the 9 public methods. This is a documented, EM-approved decision (comment at lines 24-30: "no token caching added for v1... revisit only if token-minting volume becomes a real cost") — not a defect, but worth surfacing since Template Management is now stated top priority: every template list/detail fetch from the UI (and every Iris `list_templates` call, which runs inline/unconfirmed on every turn where the model chooses it) currently costs 2 round-trips to karix-mcp instead of 1. Flagging as a known, accepted tradeoff to revisit if Iris's `list_templates` usage volume grows — not a rejection-worthy issue today.

---

## Confirmed clean (explicitly checked per founder's checklist)

- **ClaudeApiClient not reachable from Iris's chat path.** `ClaudeApiClient` (backend/src/main/java/com/metaagent/platform/infrastructure/claude/ClaudeApiClient.java) is referenced nowhere in the `iris/` package except as a *javadoc comment* in `ClaudeAdapter.java:19-22` explaining why it's deliberately NOT reused. No import, no instantiation. Confirmed via repo-wide grep — only other reference is `AgentDefaultsService` (unrelated module) and a test base class.
- **BYOK API keys never logged.** Checked every adapter's `log.error(...)` call (`ClaudeAdapter.java:76`, `OpenAiAdapter.java:94`, `NvidiaLlamaAdapter.java:106`, `KarixMessagingClient.java:128`) — all log `e.getClass().getSimpleName()`/`e.getMessage()`, never the request body or `apiKey` variable. `TemplateStudioClient.mintToken()` has an explicit inline comment "never log apiKey" (line 54) next to the one place `apiKey`/`client_secret` flows through. Error messages surfaced via `BusinessException` (e.g. "Claude API error: " + status code) contain only HTTP status, never response bodies or keys.
- **`SecretEncryptor` used correctly for `AiProviderCredential`, with a random IV per call.** `AiCredentialService.upsert()` line 55 calls `secretEncryptor.encrypt(apiKey)`; `resolveForConversation()` line 69 calls `secretEncryptor.decrypt(...)`. `SecretEncryptor.encrypt()` (SecretEncryptor.java:46-62) generates a fresh 12-byte IV via `SecureRandom` on every call (line 48-49) and prepends it to the ciphertext — no IV reuse, no ECB, AES-256-GCM with a 128-bit tag. Same class/instance is reused for `KarixEsmeCredential` — single crypto scheme, per its own javadoc contract.
- **No streaming implemented anywhere in this module** — all three adapters call `.retrieve().body(Map.class)` synchronously (single blocking HTTP call, full JSON body). `NvidiaLlamaAdapter` even explicitly sets `"stream", false` in its payload (line 86). The backpressure/cancellation question is moot: there is nothing to cancel or backpressure. Frontend (`TemplateIrisPage.tsx`) confirms this — it's a plain `useMutation` request/response, no `EventSource`/SSE/WebSocket handling anywhere.
- **Tool allowlist enforcement is in code, not prompt-trusted**, for the specific case of *which tool* runs: `IrisConversationService.java:187-188` hard-throws on any `toolName` not in the fixed `TOOLS` list before dispatch. (This is the one enforcement point that IS done correctly in code — see H1 for the payload-shape gap that isn't.)

---

## Summary
2 HIGH, 3 MEDIUM, 3 LOW. Nothing here blocks current production use (no data-loss, no key exposure, no cross-tenant leak found), but H1 (validation bypass on the model-driven write path) and H2 (non-atomic credential switch) should be fixed before this module's usage volume grows, since both are exactly the "quality gap that only shows up in production" pattern this project's memory log already has prior incidents of (Inbox `lastMessageAt`, Iris component-shape gap).
