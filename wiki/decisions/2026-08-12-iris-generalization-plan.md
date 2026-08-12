---
title: Iris Generalization Plan
tags: [architecture, iris, plan]
status: proposed
---

# PLAN: Generalize Iris beyond Template Studio

## Problem
`IrisConversationService` (domain/templatestudio/iris/) hardcodes the tool list
(create_template/edit_template/list_templates/send_test_template), the system
prompt, and the tool-dispatch switch. Adding a second Iris use case today
means copy-pasting this class, which duplicates the confirm-before-execute
mechanism, session/message persistence, and the model tool-calling loop —
all of which are genuinely feature-agnostic already.

## What stays as-is (already reusable)
- `AiProviderAdapter` interface + `ClaudeAdapter`/`OpenAiAdapter`/`NvidiaLlamaAdapter`
- `AiCredentialService` (BYOK credential resolution)
- `IrisSession`/`IrisMessage` entities and their repositories — schema is
  already feature-agnostic (no template-specific columns)

## New structure
```
domain/iris/                                  <- NEW top-level domain
  IrisConversationService.java                <- generic engine, moved+trimmed
  IrisController.java                         <- moved, unchanged
  IrisToolProvider.java                       <- NEW interface
  IrisSession.java, IrisMessage.java, ...      <- moved from templatestudio/iris
  (AiProvider* classes also move here — they're not template-specific either)

domain/templatestudio/iris/
  TemplateStudioToolProvider.java             <- NEW, implements IrisToolProvider
                                                  holds today's 4 AiToolSpecs,
                                                  the template-specific system
                                                  prompt fragment, and the
                                                  executeTool switch body
```

### IrisToolProvider interface (sketch)
```java
public interface IrisToolProvider {
    String featureKey();                                  // e.g. "template_studio"
    List<AiToolSpec> tools(Long accountId);                // may be account-scoped
    String systemPromptFragment(Long accountId);           // e.g. the WABA list text
    Map<String, Object> execute(String toolName, Map<String, Object> args, Long accountId);
}
```
`IrisConversationService.sendMessage` asks a `List<IrisToolProvider>` (Spring
injects all registered beans) for their combined tools + prompt fragments,
same pattern already used for `List<AiProviderAdapter> adapters`. Tool-name
collisions across providers are rejected at startup (fail fast), not runtime.

### IrisSession needs one addition
`featureKey` column (which provider "owns" this session) so a resumed session
knows which provider(s) to re-offer tools from. Additive migration, nullable,
defaulted to `"template_studio"` for existing rows — zero behavior change for
anything already in flight.

## Migration steps (in order, each independently deployable)
1. Add `IrisToolProvider` interface + `TemplateStudioToolProvider` implementing
   it with TODAY's exact tools/prompt/switch body copied verbatim. Wire
   `IrisConversationService` to call the (single, for now) provider instead of
   using its own hardcoded `TOOLS` constant. **No behavior change** — this
   step is pure refactor, should produce byte-identical API responses.
2. Move `domain/templatestudio/iris/*` → `domain/iris/*` except
   `TemplateStudioToolProvider` (stays in templatestudio, implements the moved
   interface). Package-only move, no logic change.
3. Additive migration: `iris_session.feature_key VARCHAR(64) NULL`, backfilled
   to `'template_studio'` for existing rows in the same migration (small
   table, safe to backfill inline rather than a separate release-cycle step).
4. Only once steps 1-3 are live and verified: a second feature can add its
   own `IrisToolProvider` bean with zero changes to `IrisConversationService`.

## Risk / rollback
- Step 1 is the only one with real risk (touches the live tool-dispatch path)
  — must be verified with the same live-test pattern used this session
  (real Iris conversation, not just unit tests) before step 2 proceeds.
- Steps 2-3 are mechanical (package move, additive column) — low risk,
  each independently revertible via git + a follow-up migration if needed.
- Kill Switch: each step ships as its own commit/deploy, so a bad step can be
  reverted without touching the others.

## Size estimate
~12-15 files touched across steps 1-2 (mostly moves), 1 new migration. Exceeds
the 3-file/400-line Plan-First threshold — this document is that plan.
Recommend building as 2 separate PRs: (1) provider-interface extraction with
zero behavior change, (2) the package move + featureKey column, since (1)
is the one that needs live verification and (2) is pure mechanics.

## Related
- Raised by founder 2026-08-12, same session as the Iris logging audit and
  create_template confirmation-prose fix (see project memory).
